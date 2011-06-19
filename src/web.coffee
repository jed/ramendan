http    = require "http"
url     = require "url"

static  = require "node-static"
file = new static.Server "./public"

PORT = process.env.PORT or 8000

{User, Entry} = require "./models"

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

  # get latest entries
  /^\/api\/entries\/latest$/
  (req, cb) ->
    Entry.latest cb
]

server = http.createServer (req, res) ->
  uri = url.parse req.url, true
  path = uri.pathname
  lang = req.headers["accept-language"]?.toLowerCase().match(/en|ja/g)?[0] or "en"
  index = 0

  while pattern = handlers[index++]
    handler = handlers[index++]

    if req.captures = path.match pattern
      return handler req, (err, data) ->
        body = data: data, lang: lang

        callback = uri.query.callback?.match(/^\w+$/)?[0]
        body = "#{callback or 'alert'}(#{JSON.stringify body})"

        res.writeHead 200,
          "Content-Length": Buffer.byteLength body
          "Content-Type":   "text/javascript"

        res.end body
  
  index = if "ramen" of uri.query then "index" else "teaser.#{lang}"
  req.url = "/#{index}.html" unless ~path.indexOf "."
  file.serve req, res
  
server.listen PORT, ->
  console.log "ramendan running on port #{PORT}"
