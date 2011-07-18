PORT = process.env.PORT

express = require "express"
app = express.createServer()

{User, Entry} = require "./models"

app.set "view engine", "hbs"

app.configure ->
  app.use express.static "#{__dirname}/../public"
  app.use express.errorHandler dumpExceptions: true, showStack: true
  app.use express.cookieParser()
  app.use express.session secret: "n0o0o0o0odles!"
  app.use app.router

app.get "/", (req, res) ->
  res.render "index-#{getLang req}", name: "bar"

app.get "/users/:id", (req, res) ->
  User.fromHandle req.params.id, (err, user) ->
    if err
      res.render "user404-#{getLang req}", name: req.params.id

    else
      user.readWithEntries (err, user) ->
        res.render "user-#{getLang req}", user

app.listen PORT, -> console.log "now listening on port #{PORT}"

getLang = (req) ->
  req.headers["accept-language"]?.toLowerCase().match(/en|ja/g)?[0] or "en"