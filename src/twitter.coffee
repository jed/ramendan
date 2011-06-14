{OAuth} = require "oauth"

{ TWITTER_TOKEN,
  TWITTER_TOKEN_SECRET,
  TWITTER_KEY,
  TWITTER_SECRET } = process.env

resources =
  followers: "http://api.twitter.com/1/followers/ids.json"

oa = new OAuth(
  "https://twitter.com/oauth/request_token",
  "https://twitter.com/oauth/access_token",
  TWITTER_KEY,
  TWITTER_SECRET,
  "1.0A",
  "http://localhost:3000/oauth/callback",
  "HMAC-SHA1"
)

# oa.get resources.followers, TWITTER_TOKEN, TWITTER_TOKEN_SECRET, (err, data) ->
# console.log data

handleEvent = (data) ->
  console.log data

connectStream = ->
  console.log "connecting to @ramendan stream..."

  request = oa.get "https://userstream.twitter.com/2/user.json", TWITTER_TOKEN, TWITTER_TOKEN_SECRET
  
  request.addListener "response", (res) ->
    res.setEncoding "utf8"
  
    res.addListener "data", (chunk) ->
      try data = JSON.parse chunk
      handleEvent data or {}
  
    res.addListener "end", ->
      console.log "connection terminated."
      connectStream()
  
  request.end()
