# --key tcrzlUrmOHd6idGBYC4KTA
# --secret JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc

{OAuth} = require "oauth"

accessToken = "315955679-o0jcyL1G1p7KgtSD6IUvksGyPvlWQwyWexDfNwMG"
accessTokenSecret = "G9F1pJYqoEgfHe55S7OX8NoiIcOZmAfVJsWYgyA7Y"

resources =
  followers: "http://api.twitter.com/1/followers/ids.json"

oa = new OAuth(
  "https://twitter.com/oauth/request_token",
  "https://twitter.com/oauth/access_token", 
  "tcrzlUrmOHd6idGBYC4KTA",
  "JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc", 
  "1.0A",
  "http://localhost:3000/oauth/callback",
  "HMAC-SHA1"
)

# oa.get resources.followers, accessToken, accessTokenSecret, (err, data) ->
# console.log data

handleEvent = (data) ->
  console.log data

connectStream = ->
  console.log "connecting to @ramendan stream..."

  request = oa.get "https://userstream.twitter.com/2/user.json", accessToken, accessTokenSecret
  
  request.addListener "response", (res) ->
    res.setEncoding "utf8"
  
    res.addListener "data", (chunk) ->
      try data = JSON.parse chunk
      handleEvent data or {}
  
    res.addListener "end", ->
      console.log "connection terminated."
      connectStream()
  
  request.end()