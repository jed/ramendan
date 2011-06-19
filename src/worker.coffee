{Tweet} = require "./models"
twitter = require "./twitter"

console.log "connecting to twitter..."

twitter.stream "user", (stream) ->
  console.log "connected to twitter: #{JSON.stringify stream}"

  stream.on "end", ->
    console.log "end"

  stream.on "error", (err) ->
    console.log err

  stream.on "data", (data) ->
    console.log data
    #(new Tweet data).save()
