http    = require "http"
url     = require "url"

static  = require "node-static"
redis   = require "redis"
{OAuth} = require "oauth"

env =
  try require "./env"
  catch e then process.env

{ TWITTER_TOKEN,
  TWITTER_TOKEN_SECRET,
  TWITTER_KEY,
  TWITTER_SECRET,
  REDISTOGO_URL,
  PORT } = env

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
  @all: (cb) ->
    db.zrevrange "/followers", 0, -1, cb

  constructor: (attrs) ->
    @[key] = value for key, value of attrs
 
  read: (cb) ->
    uri = "/followers/#{@id}"

    db.exists uri, (err, exists) ->
      if err or not exists then cb 404
      else db.hgetall uri, (err, props) ->
        if err then cb err
        else cb null, new Follower props

  save: (cb) ->
    properties = {}

    for own key, value of @
      properties[key] = value if typeof value is "string"

    op = db.multi()

    op.hmset "/followers/#{@id}" , properties
    op.zadd  "/followers"        , +new Date(@since), @id

    op.exec (err) => cb err, @

# oa.get resources.followers, TWITTER_TOKEN, TWITTER_TOKEN_SECRET, (err, data) ->
# console.log data

handleEvent = (data) ->
  return unless data?
  
  if data.event is "follow"
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

      handle = follower.handle

      console.log "new follower: #{follower.handle}"

      request = oa.post(
        "http://api.twitter.com/1/statuses/update.json"
        TWITTER_TOKEN
        TWITTER_TOKEN_SECRET
        status: "@#{handle} Your #ramendan calendar is ready! http://ramendan.com/#{handle}"
        (err, data) ->
          console.log err or "confirmation sent to #{handle}."
      )

do connectStream = ->
  console.log "connecting to twitter..."

  request = oa.get "https://userstream.twitter.com/2/user.json", TWITTER_TOKEN, TWITTER_TOKEN_SECRET
  
  request.addListener "response", (res) ->
    console.log "connected to twitter."

    res.setEncoding "utf8"
  
    res.addListener "data", (chunk) ->
      handleEvent try JSON.parse chunk
  
    res.addListener "end", (data) ->
      console.log "disconnected from twitter.", data
      setTimeout connectStream, 5000
  
  request.end()

server = http.createServer (req, res) ->
  req.url is "favicon.ico" or req.url = "/"
  req.addListener "end", -> file.serve req, res

server.listen PORT, ->
  console.log "ramendan running on port #{PORT}"
