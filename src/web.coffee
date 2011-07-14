PORT = process.env.PORT

express = require "express"
app = express.createServer()

app.set "view engine", "hbs"

app.configure ->
  app.use express.static "#{__dirname}/../public"
  app.use express.errorHandler dumpExceptions: true, showStack: true
  app.use express.cookieParser()
  app.use express.session secret: "n0o0o0o0odles!"
  app.use app.router

app.get "/", (req, res) ->
  lang = getLang req
  res.render "index-#{'en'}", name: "bar"

app.get "/users/:id", (req, res) ->
  lang = getLang req
  res.render "user-#{'en'}", name: req.params.id

app.listen PORT, -> console.log "now listening on port #{PORT}"

getLang = (req) ->
  req.headers["accept-language"]?.toLowerCase().match(/en|ja/g)?[0] or "en"
  