http    = require "http"
url     = require "url"

static  = require "node-static"
redis   = require "redis"
{OAuth} = require "oauth"

env =
  if process.env.SERVER is "PRODUCTION" then process.env
  else require "./env"

{ TWITTER_TOKEN,
  TWITTER_TOKEN_SECRET,
  TWITTER_KEY,
  TWITTER_SECRET,
  REDISTOGO_URL,
  PORT } = env

redisUrl = url.parse REDISTOGO_URL

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

db   = redis.createClient redisUrl.port, redisUrl.hostname
db.auth (redisUrl.auth.split ":")[1], ->
	db.set "somekey", "somevalue", ->
		db.get "somekey", (err, data) ->
			console.log "somekey is #{data}"

# oa.get resources.followers, TWITTER_TOKEN, TWITTER_TOKEN_SECRET, (err, data) ->
# console.log data

handleEvent = (data) ->
  console.log data

do connectStream = ->
  console.log "connecting to @ramendan stream..."

  request = oa.get "https://userstream.twitter.com/2/user.json", TWITTER_TOKEN, TWITTER_TOKEN_SECRET
  
  request.addListener "response", (res) ->
    res.setEncoding "utf8"
  
    res.addListener "data", (chunk) ->
      try data = JSON.parse chunk
      handleEvent data or {}
  
    res.addListener "end", (data) ->
      console.log "connection terminated.", data
      # connectStream()
  
  request.end()

server = http.createServer (req, res) ->
  req.url is "favicon.ico" or req.url = "/"
  req.addListener "end", -> file.serve req, res

server.listen PORT, ->
  console.log "ramendan running on port #{PORT}"
