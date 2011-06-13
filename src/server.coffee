PORT = process.env.PORT || 3000

http   = require "http"
static = require "node-static"

file   = new static.Server "./public"

server = http.createServer (req, res) ->
  req.url is "favicon.ico" or req.url = "/"
  req.addListener "end", -> file.serve req, res

server.listen PORT, ->
  console.log "ramendan running on port #{PORT}"
