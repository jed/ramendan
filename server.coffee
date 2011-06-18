http    = require "http"
url     = require "url"

PORT                 = process.env.PORT or 5000
TWITTER_TOKEN        = '315955679-zp64SIsgXwlW28qDEDt69APrql7u0AJFJFthJXoS'
TWITTER_TOKEN_SECRET = '4BYQzGuK3dd5tNbo8orWwiFS9f7dZOATvz8MrLnrQ'
TWITTER_KEY          = 'tcrzlUrmOHd6idGBYC4KTA'
TWITTER_SECRET       = 'JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc'
EMBEDLY              = 'daf28dd296b811e0bc3c4040d3dc5c07'
TWITTER_ID           = 315955679

static  = require "node-static"
redis   = require "redis"
embedly = require "embedly"
twitter = require "twitter"

file = new static.Server "./public"

db = redis.createClient()

embedly = new embedly.Api key: EMBEDLY

twit = new twitter
  consumer_key:        TWITTER_KEY
  consumer_secret:     TWITTER_SECRET
  access_token_key:    TWITTER_TOKEN
  access_token_secret: TWITTER_TOKEN_SECRET

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

  readWithEntries: (cb) ->
    @read (err, user) ->
      db.smembers "#{user.uri}/entries", (err, list) ->
        i = list.length
        user.entries = list
  
        do run = ->
          return cb null, user unless i--
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
    db.lrange "/entries/latest", 0, -1, (err, list = []) ->
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

getPhoto = (url, cb) ->
  req = embedly.oembed url: url

  req.on "complete", ([obj]) ->
    if obj?.type is "photo"
	      cb null, obj
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
    if err then twit.updateStatus(
      "@#{user.handle} Sorry, but you're not a true follower yet. Follow @ramendan and try again."
      (err, data) -> console.log err or "got entry from non-follower: #{user.handle}."
    )

    else getDay entry.lat, entry.lng, (err, day) ->
      if err then return console.log "could not get valid day"
      entry.uri = "#{user.uri}/entries/#{day}"
      entry.invalid = "notRamendan" if day < 20110731 or day > 20110829
      entry.invalid ||= err if err
      getPhoto entry.url, (err, data) ->
        entry.invalid ||= err if err
        entry.img = data.url
        entry.height = data.height
        entry.width = data.width
        entry.thumb = data.thumbnail_url
        entry.thumbWidth = data.thumbnail_height
        entry.thumbHeight = data.thumbnail_width
        
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
    since:  new Date

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

twit.stream "user", (stream) ->
  stream.on "data", (data) ->
    mention = data.in_reply_to_user_id is TWITTER_ID
    location = data.geo?.coordinates
    uri = data.entities?.urls?[0]

    if not location and coords = data.place?.bounding_box?.coordinates[0]
      location = data.geo = coordinates: [
        (coords[0][1] + coords[2][1]) / 2
        (coords[0][0] + coords[2][0]) / 2
      ]

    if data.event is "follow" then onFollow data

    else if mention and location and uri then onEntry data

handlers = [
  # get front page
  /^\/api$/
  (req, cb) ->
    Entry.latest (err, entries) -> User.latest (err, users) ->
      cb null, entries: entries, users: users

  # get latest users
  /^\/api\/users\/latest$/
  (req, cb) ->
    User.latest cb

  # get a user by screen name
  /^\/api\/users\/(\w+)$/
  (req, cb) ->
    db.hget "/handles", req.captures[1], (err, uri) ->
      return cb 404 unless uri

      (new User uri: uri).readWithEntries cb

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
  
  index = if process.env.JOYENT then "teaser" else "index"
  req.url = "/#{index}.html" unless ~path.indexOf "."
  file.serve req, res
  
server.listen PORT, ->
  console.log "ramendan running on port #{PORT}"
