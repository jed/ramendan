http    = require "http"
url     = require "url"

static  = require "node-static"
redis   = require "redis"
{OAuth} = require "oauth"
embedly = require "embedly"

{ TWITTER_TOKEN,
  TWITTER_TOKEN_SECRET,
  TWITTER_KEY,
  TWITTER_SECRET,
  TWITTER_ID,
  EMBEDLY,
  PORT } = require "./env"

embedly = new embedly.Api key: EMBEDLY

db = redis.createClient()

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

class User
  @latest: (cb) ->
    db.zrevrange "/users", 0, 19, (err, list) ->
      i = list.length

      do run = ->
        return cb null, list unless i--
        (new User uri: list[i]).read (err, user) ->
          list[i] = user; run()

  constructor: (attrs) ->
    @[key] = value for key, value of attrs
 
  read: (cb) ->
    db.exists @uri, (err, exists) =>
      if err then cb message: err
      else if not exists then cb status: 404, message: "Not found."
      else db.hgetall @uri, (err, props) ->
        if err then cb message: err
        else cb null, new User props

  readEntries: (cb) ->
    db.smembers "#{@uri}/entries", (err, list) ->
      i = list.length

      do run = ->
        return cb null, list unless i--
        (new Entry uri: list[i]).read (err, entry) ->
          list[i] = entry; run()

  save: (cb) ->
    op = db.multi()

    op.hmset @uri , @
    op.zadd  "/users", +new Date(@since), @uri
    op.hset  "/handles", @handle , @uri

    op.exec (err) => cb err, @

class Entry
  @latest: (cb) ->
    db.lrange 0, -1, (err, list = []) ->
      i = list.length

      do run = ->
        return cb null, list unless i--
        (new Entry uri: list[i]).read (err, entry) ->
          list[i] = entry; run()

  constructor: (attrs) ->
    @[key] = value for key, value of attrs

  read: (cb) ->
    db.exists @uri, (err, exists) =>
      if err then cb message: err
      else if not exists then cb status: 404, message: "Not found."
      else db.hgetall @uri, (err, props) ->
        if err then cb message: err
        else cb null, new Entry props

  save: (cb) ->
    op = db.multi()
    op.sadd "#{@user}/entries", @uri

    op.lpush "/entries/latest", @uri
    op.ltrim "/entries/latest", 0, 19

    op.hmset @uri, @

    op.exec (err) => cb err, @

# oa.get resources.followers, TWITTER_TOKEN, TWITTER_TOKEN_SECRET, (err, data) ->
# console.log data

getPhotoUrl = (url, cb) ->
  req = embedly.oembed url: url

  req.on "complete", ([obj]) ->
    if obj?.type is "photo"
	      cb null, obj.url
    else
      cb "notPhoto"

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
          err  = if dusk or dawn then null else "notAfterSunset"
          cb err, day - dawn

        catch e
          cb e

onEntry = (data) ->
  user = new User
    uri: "/users/#{data.user.id_str}"
    handle: data.user.screen_name

  entry = new Entry
    user: user.uri
    url:  data.entities?.urls[0].url
    time: data.created_at
    text: data.text.slice 10
    invalid: no

  [entry.lat, entry.lng] = data.geo.coordinates

  user.read (err) ->
    if err then return oa.post(
      "http://api.twitter.com/1/statuses/update.json"
      TWITTER_TOKEN
      TWITTER_TOKEN_SECRET
      status: "@#{user.handle} Sorry, you need to be a @ramendan follower to play. Try again."
      (err, data) ->
        console.log err or "got entry from non-follower: #{user.handle}."
    )

    else getDay entry.lat, entry.lng, (err, day) ->
      entry.uri = "#{user.uri}/entries/#{day}"
      entry.invalid = "notRamendan" if day < 20110731 or day > 20110829
      entry.invalid ||= err if err
      getPhotoUrl entry.url, (err, url) ->
        entry.invalid ||= err if err
        entry.img = url
        entry.save (err, entry) ->
          console.log "new entry: #{entry.uri} - #{entry.invalid or 'valid'}"

onFollow = (data) ->
  user = new User
    uri:    "/users/#{data.source.id_str}"
    handle: data.source.screen_name.toLowerCase()
    name:   data.source.name
    img:    data.source.profile_image_url
    blurb:  data.source.description
    lang:   data.source.lang
    since:  data.source.created_at

  user.save (err, user) ->
    return if err

    console.log "new user: #{user.handle}"
    
    ###
    oa.post(
      "http://api.twitter.com/1/statuses/update.json"
      TWITTER_TOKEN
      TWITTER_TOKEN_SECRET
      status: "@#{user.handle} Your #ramendan calendar is ready! http://ramendan.com/#{user.handle}"
      (err, data) ->
        console.log err or "confirmation sent to #{user.handle}."
    )
    ###

onEvent = (data) ->
  return unless data?

  console.log "incoming event: #{data.event or 'heartbeat'}"

  return onFollow data if data.event is "follow"
 
  if data.in_reply_to_user_id is TWITTER_ID and
    data.geo and
    data.entities?.urls.length then onEntry data

do connectStream = ->
  console.log "connecting to twitter..."

  request = oa.get "https://userstream.twitter.com/2/user.json", TWITTER_TOKEN, TWITTER_TOKEN_SECRET
  
  request.addListener "response", (res) ->
    console.log "connected to twitter."

    res.setEncoding "utf8"
  
    res.addListener "data", (chunk) ->
      onEvent try JSON.parse chunk
  
    res.addListener "end", (data) ->
      console.log "disconnected from twitter.", data
      setTimeout connectStream, 5000
  
  request.end()

handlers = [
  # get latest users
  /^\/api\/users\/latest$/
  (req, cb) ->
    User.latest cb

  # get a user by screen name
  /^\/api\/users\/(\w+)$/
  (req, cb) ->
    db.hget "/handles", req.captures[1], (err, uri) ->
      return cb 404 unless uri

      (new User uri: uri).read cb

  # get entries for a user by screen name
  /^\/api\/users\/(\w+)\/entries$/
  (req, cb) ->
    db.hget "/handles", req.captures[1], (err, uri) ->
      return cb 404 unless uri
      (new User uri: uri).readEntries cb

  # get latest entries
  /^\/api\/entries\/latest$/
  (req, cb) ->
    Entry.latest cb
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
  
server.listen process.env.PORT, ->
  console.log "ramendan running on port #{process.env.PORT}"
