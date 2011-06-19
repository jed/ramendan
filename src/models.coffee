db      = require "./db"
{OAuth} = require "oauth"

embedly = require "embedly"
embedly = new embedly.Api key: 'daf28dd296b811e0bc3c4040d3dc5c07'

exports.User = class User
  @latest: (cb) ->
    db.zrevrange "/users", 0, 19, (err, list) ->
      i = list.length

      do run = ->
        return cb null, list unless i--
        (new User uri: list[i]).read (err, user) ->
          list[i] = user; run()

  constructor: (attrs) ->
    @[key] = value for key, value of attrs
 
  read: (cb) ->
    db.exists @uri, (err, exists) =>
      if err then cb message: err
      else if not exists then cb status: 404, message: "Not found."
      else db.hgetall @uri, (err, props) ->
        if err then cb message: err
        else cb null, new User props

  readWithEntries: (cb) ->
    @read (err, user) ->
      db.smembers "#{user.uri}/entries", (err, list) ->
        i = list.length
        user.entries = list
  
        do run = ->
          return cb null, user unless i--
          (new Entry uri: list[i]).read (err, entry) ->
            list[i] = entry; run()

  save: (cb) ->
    op = db.multi()

    op.hmset @uri , @
    op.zadd  "/users", +new Date(@since), @uri
    op.hset  "/handles", @handle , @uri

    op.exec (err) => cb err, @

exports.Twitter = class Twitter
  constructor: (attrs) ->
    @[key] = value for key, value of attrs

    @oa = new OAuth(
      "https://twitter.com/oauth/request_token"
      "https://twitter.com/oauth/access_token"
      @consumer.key
      @consumer.secret
      "1.0A"
      null
      "HMAC-SHA1"
    )
    
  listen: (cb) ->
    request = @oa.get(
      "https://userstream.twitter.com/2/user.json"
      @token.key
      @token.secret
    )

    request.on "response", (response) ->
      console.log "connected to twitter."

      response.setEncoding "utf8"
      response.on "data", (json) -> try cb Tweet.create JSON.parse json
      response.on "end", -> console.log "disconnected from twitter."

    request.end()

exports.Tweet = class Tweet
  @create: (obj) ->
    isReply = data.in_reply_to_screen_name is "ramendan"
    location = data.geo?.coordinates
    uri = data.entities?.urls?[0]

    if not location and coords = data.place?.bounding_box?.coordinates[0]
      location = data.geo = coordinates: [
        (coords[0][1] + coords[2][1]) / 2
        (coords[0][0] + coords[2][0]) / 2
      ]

    if data.event is "follow" then onFollow data

    else if isReply and location and uri then onEntry data

  constructor: (attrs) ->
    @[key] = value for key, value of attrs

  save: ->

exports.Entry = class Entry extends Tweet
  @latest: (cb) ->
    db.lrange "/entries/latest", 0, -1, (err, list = []) ->
      i = list.length

      do run = ->
        return cb null, list unless i--
        (new Entry uri: list[i]).readWithUser (err, entry) ->
          list[i] = entry; run()

  constructor: (attrs) ->
    @[key] = value for key, value of attrs

  read: (cb) ->
    db.exists @uri, (err, exists) =>
      if err then cb message: err
      else if not exists then cb status: 404, message: "Not found."
      else db.hgetall @uri, (err, props) ->
        if err then cb message: err
        else cb null, new Entry props

  readWithUser: (cb) ->
    @read (err, entry) ->
      return cb err if err

      (new User uri: entry.user).read (err, user) ->
        entry.user = user
        cb err, entry

  save: (cb) ->
    op = db.multi()
    op.sadd "#{@user}/entries", @uri

    op.lpush "/entries/latest", @uri
    op.ltrim "/entries/latest", 0, 19

    op.hmset @uri, @

    op.exec (err) => cb err, @

getPhoto = (url, cb) ->
  req = embedly.oembed url: url

  req.on "complete", ([obj]) ->
    if obj?.type is "photo"
	      cb null, obj
    else
      cb "notPhoto"

  req.start()

getDay = (lat, lng, cb) ->
  http.get
    host: "api.geonames.org"
    path: "/timezoneJSON?username=jed&lat=#{lat}&lng=#{lng}"

    (response) ->
      data = ""
      response.setEncoding "utf8"
      response.on "data", (chunk) -> data += chunk
      response.on "end", ->
        try
          {sunrise, sunset, time} = JSON.parse data
          dusk = time > sunset
          dawn = time < sunrise
          day  = time.split(" ")[0].replace /-/g, ""
          err  = if dusk or dawn then null else "notAfterSunset"
          cb err, day - dawn

        catch e
          cb e

onEntry = (data) ->
  user = new User
    uri: "/users/#{data.user.id_str}"
    handle: data.user.screen_name

  entry = new Entry
    user: user.uri
    url:  data.entities?.urls[0].url
    time: data.created_at
    text: data.text.slice 10
    invalid: no

  [entry.lat, entry.lng] = data.geo.coordinates

  user.read (err) ->
    ###
    if err then twit.updateStatus(
      "@#{user.handle} Sorry, but you're not a true follower yet. Follow @ramendan and try again."
      (err, data) -> console.log err or "got entry from non-follower: #{user.handle}."
    )
    ###

    getDay entry.lat, entry.lng, (err, day) ->
      entry.uri = "#{user.uri}/entries/#{day}"
      entry.invalid = "notRamendan" if day < 20110731 or day > 20110829
      entry.invalid ||= err if err
      getPhoto entry.url, (err, data) ->
        entry.invalid ||= err if err
        entry.img = data.url
        entry.height = data.height
        entry.width = data.width
        entry.thumb = data.thumbnail_url
        entry.thumbWidth = data.thumbnail_width
        entry.thumbHeight = data.thumbnail_height
        
        entry.save (err, entry) ->
          console.log "new entry: #{entry.uri} - #{entry.invalid or 'valid'}"

onFollow = (data) ->
  user = new User
    uri:    "/users/#{data.source.id_str}"
    handle: data.source.screen_name.toLowerCase()
    name:   data.source.name
    img:    data.source.profile_image_url
    blurb:  data.source.description
    lang:   data.source.lang
    since:  new Date

  user.save (err, user) ->
    return if err

    console.log "new user: #{user.handle}"
    ###
    twit.updateStatus(
      "@#{user.handle} Your #ramendan calendar is ready! http://ramendan.com/#{user.handle}"
      (err, data) -> console.log err or "confirmation sent to #{user.handle}."
    )
    ###

