PORT = process.env.PORT

express = require "express"
app = express.createServer()

{User, Entry} = require "./models"

app.set "view engine", "mustache"
app.register ".mustache", require "stache"

app.configure ->
  app.use express.cookieParser()
  app.use express.session secret: "n0o0o0o0odles!"
  app.use app.router
  
app.configure "development", ->
  app.use express.static "#{__dirname}/../public"
  app.use express.errorHandler dumpExceptions: true, showStack: true

app.configure "production", ->
  app.use express.static "#{__dirname}/../public", maxAge: 31557600000
  app.use express.errorHandler()

app.get "/", (req, res) ->
  User.top (err, users) ->
    res.render "index-#{getLang req}", users: users

app.get /^\/(\w+)$/, (req, res) ->
  res.redirect "/users/#{req.params[0]}"

app.get "/users/:id", (req, res) ->
  User.fromHandle req.params.id, (err, user) ->
    if not user
      res.render "user404-#{getLang req}", name: req.params.id

    else
      user.readWithEntries (err, user) ->
        res.render "user-#{getLang req}", user

app.listen PORT, -> console.log "now listening on port #{PORT}"

getLang = (req) ->
  # japanese support can wait
  #req.headers["accept-language"]?.toLowerCase().match(/en|ja/g)?[0] or "en"
  "en"