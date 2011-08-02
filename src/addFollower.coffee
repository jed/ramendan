{User, Tweet} = require "./models"
handle = process.argv[2]

user = new User handle: handle
user.fetch (data) ->
  tweet = new Tweet source: data
  tweet.onFollow -> process.exit 1