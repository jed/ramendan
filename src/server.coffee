http    = require "http"
url     = require "url"

static  = require "node-static"
redis   = require "redis"
{OAuth} = require "oauth"
embedly = require "embedly"

env =
  try require "./env"
  catch e then process.env

{ TWITTER_TOKEN,
  TWITTER_TOKEN_SECRET,
  TWITTER_KEY,
  TWITTER_SECRET,
  TWITTER_ID,
  REDISTOGO_URL,
  EMBEDLY,
  PORT } = env

embedly = new embedly.Api key: EMBEDLY

redisUrl = url.parse REDISTOGO_URL
redisUrl.auth = (redisUrl.auth.split ":")[1]
db = redis.createClient redisUrl.port, redisUrl.hostname
db.auth redisUrl.auth

file = new static.Server "./public"

oa = new OAuth(
  "https://twitter.com/oauth/request_token",
  "https://twitter.com/oauth/access_token",
  TWITTER_KEY,
  TWITTER_SECRET,
  "1.0A",
  "http://localhost:3000/oauth/callback",
  "HMAC-SHA1"
)

class Follower
  @latest: (cb) ->
    db.zrevrange "/followers", 0, 19, (err, list) ->
      i = list.length

      do run = ->
        return cb null, list unless i--
        (new Follower id: list[i]).read (err, user) ->
          list[i] = user; run()

  constructor: (attrs) ->
    @[key] = value for key, value of attrs
 
  read: (cb) ->
    uri = "/followers/#{@id}"

    db.exists uri, (err, exists) ->
      if err then cb message: err
      else if not exists then cb status: 404, message: "Not found."
      else db.hgetall uri, (err, props) ->
        if err then cb message: err
        else cb new Follower props

  readEntries: (cb) ->
    uri = "/followers/#{@id}"

    db.exists uri, (err, exists) ->
      if err then cb message: err
      else if not exists then cb status: 404, message: "Not found."
        db.zrange "#{uri}/entries", 0, -1, (err, list) ->
          follower.entries = list
          cb null, follower

  save: (cb) ->
    op = db.multi()

    op.zadd  "/followers", +new Date(@since), @id
    op.hmset "/followers/#{@id}" , @
    op.hset  "/handles", @handle , @id

    op.exec (err) => cb err, @

class Entry
  @latest: (cb) ->
    db.zrevrange "/entries", 0, 19, (err, list) ->
      i = list.length

      do run = ->
        return cb null, list unless i--
        (new Entry id: list[i]).read (err, entry) ->
          list[i] = entry; run()

  constructor: (attrs) ->
    @[key] = value for key, value of attrs

  read: (cb) ->
    uri = "/entries/#{@id}"

    db.exists uri, (err, exists) ->
      if err then cb message: err
      else if not exists then cb status: 404, message: "Not found."
      else db.hgetall uri, (err, props) ->
        if err then cb message: err
        else cb null, new Entry props

  save: (cb) ->
    op = db.multi()

    op.zadd  "/entries", +new Date(@time), @id unless @invalid
    op.hmset "/entries/#{@id}", @
    op.zadd  "/followers/#{@user}/entries", @day, @id

    op.exec (err) => cb err, @

# oa.get resources.followers, TWITTER_TOKEN, TWITTER_TOKEN_SECRET, (err, data) ->
# console.log data

getPhotoUrl = (url, cb) ->
  req = embedly.oembed url: url

  req.on "complete", ([obj]) ->
    if obj?.type is "photo"
      cb null, obj.url
    else
      cb "not_a_photo"

  req.start()

getDay = (lat, lng, cb) ->
  http.get
    host: "api.geonames.org"
    path: "/timezoneJSON?username=jed&lat=#{lat}&lng=#{lng}"

    (response) ->
      data = ""
      response.setEncoding "utf8"
      response.on "data", (chunk) -> data += chunk
      response.on "end", ->
        try
          {sunrise, sunset, time} = JSON.parse data
          dusk = time > sunset
          dawn = time < sunrise
          day  = time.split(" ")[0].replace /-/g, ""
          err  = if dusk or dawn then null else "not_after_sunset"
          cb err, day - dawn

        catch e
          cb e

onEntry = (data) ->
  [lat, lng] = data.geo.coordinates

  entry = new Entry
    id:   data.id_str
    user: data.user.id_str
    lat:  lat
    lng:  lng
    url:  data.entities?.urls[0].url
    time: data.created_at
    invalid: no
  
  (new Follower id: entry.id).read (err, follower) ->
    if err then oa.post(
      "http://api.twitter.com/1/statuses/update.json"
      TWITTER_TOKEN
      TWITTER_TOKEN_SECRET
      status: "@#{follower.handle} Sorry, you need to be a @ramendan follower to play. Try again."
      (err, data) ->
        console.log err or "got entry from non-follower: #{follower.handle}."
    )

    else getDay lat, lng, (err, day) ->
      entry.day = day
      entry.invalid = err if err
      getPhotoUrl entry.url, (err, url) ->
        entry.invalid ||= err if err
        entry.img = url
        entry.save (err, entry) ->
          console.log "new entry: #{entry.id} - #{entry.invalid or 'valid'}"

onFollow = (data) ->
  follower = new Follower
    id:     data.source.id_str
    handle: data.source.screen_name
    name:   data.source.name
    img:    data.source.profile_image_url
    blurb:  data.source.description
    lang:   data.source.lang
    since:  data.source.created_at

  follower.save (err, follower) ->
    return if err

    console.log "new follower: #{follower.handle}"

    oa.post(
      "http://api.twitter.com/1/statuses/update.json"
      TWITTER_TOKEN
      TWITTER_TOKEN_SECRET
      status: "@#{follower.handle} Your #ramendan calendar is ready! http://ramendan.com/#{follower.handle}"
      (err, data) ->
        console.log err or "confirmation sent to #{follower.handle}."
    )

onEvent = (data) ->
  return unless data?
 
  if data.in_reply_to_user_id is TWITTER_ID and
    data.geo and
    data.entities?.urls.length then onEntry data

  else if data.event is "follow" then onFollow data

do connectStream = ->
  console.log "connecting to twitter..."

  request = oa.get "https://userstream.twitter.com/2/user.json", TWITTER_TOKEN, TWITTER_TOKEN_SECRET
  
  request.addListener "response", (res) ->
    console.log "connected to twitter."

    res.setEncoding "utf8"
  
    res.addListener "data", (chunk) ->
      console.log chunk
      onEvent try JSON.parse chunk
  
    res.addListener "end", (data) ->
      console.log "disconnected from twitter.", data
      setTimeout connectStream, 5000
  
  request.end()

handlers = [
  # get latest followers
  /^\/api\/followers\/latest$/
  (req, cb) ->
    Follower.latest cb

  # get a follower by screen name
  /^\/api\/followers\/(\w+)$/
  (req, cb) ->
    db.hget "/handles", req.captures[1], (err, id) ->
      return cb 404 unless id

      (new Follower id: id).read cb

  # get latest entries
  /^\/api\/entries\/latest$/
  (req, cb) ->
    Entry.latest cb

  # get an entry by id
  /^\/api\/entries\/(\d+)$/
  (req, cb) ->
    (new Entry id: req.captures[1]).read cb
]

server = http.createServer (req, res) ->
  uri = url.parse req.url, true
  path = uri.pathname
  index = 0

  while pattern = handlers[index++]
    handler = handlers[index++]

    if req.captures = path.match pattern
      return handler req, (err, body) ->
        callback = uri.query.callback?.match(/^\w+$/)?[0]
        body = "#{callback or 'alert'}(#{JSON.stringify body})"

        res.writeHead 200,
          "Content-Length": Buffer.byteLength body
          "Content-Type":   "text/javascript"

        res.end body

  file.serve req, res
  
server.listen PORT, ->
  console.log "ramendan running on port #{PORT}"
