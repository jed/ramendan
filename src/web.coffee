http    = require "http"
url     = require "url"
fs      = require "fs"
_       = require "underscore"
static  = require "node-static"

PORT = process.env.PORT

{User, Entry} = require "./models"

file = new static.Server "./public"

templates =
  en: {}
  ja: {}

do compileTemplates = ->
  console.log "recompiling templates..."
  for lang, obj of templates
    for name in ["index", "layout", "user"]
      contents = fs.readFileSync "./templates/#{name}.#{lang}.html", "utf8"
      try obj[name] = _.template contents

server = http.createServer (req, res) ->
  uri = url.parse req.url, true
  path = uri.pathname
  lang = req.headers["accept-language"]?.toLowerCase().match(/en|ja/g)?[0] or "en"
  i = 0
  isDev = "dev" of uri.query

  compileTemplates() if isDev

  handlers = [
    # get front page
    /^\/$/
    (req, cb) ->
      cb null, templates[lang].index {}

    # get a user by screen name
    /^\/users\/(\w+)$/
    (req, cb) ->
      User.fromHandle req.captures[1], (err, user) ->
        if err then cb err

        else user.readWithEntries (err, user) ->
          cb null, templates[lang].user user
  ]

  while pattern = handlers[i++]
    handler = handlers[i++]

    if req.captures = path.match pattern
      return handler req, (err, html) ->
        if err then html = "404"

        html = templates[lang].layout body: html

        res.writeHead 200,
          "Content-Length": Buffer.byteLength html
          "Content-Type":   "text/html"

        res.end html

  if path is "/" and not isDev
    req.url = "/teaser.#{lang}.html"

  file.serve req, res
  
server.listen PORT, ->
  console.log "ramendan running on port #{PORT}"
