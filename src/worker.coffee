{Tweet} = require "./models"
twitter = require "./twitter"

twitter.stream "user", (stream) ->
  stream.on "data", (data) ->
    (new Tweet data).save()
