http = require "http"

{Twitter, User, Entry} = require "./models"

embedly = require "embedly"
embedly = new embedly.Api key: 'daf28dd296b811e0bc3c4040d3dc5c07'

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
          {sunrise, sunset, time, countryName} = JSON.parse data
          dusk = time > sunset
          dawn = time < sunrise
          day  = (0 | new Date(time) / 86400000) - 15186
          err  = if dusk or dawn then null else "notAfterSunset"
          cb err, day - dawn, countryName or "Somewhere"

        catch e
          cb e

onEntry = (data) ->
  console.log "incoming entry: /status/#{data.id}"

  user = new User
    uri: "/users/#{data.user.id_str}"
    handle: data.user.screen_name

  entry = new Entry
    user: user.uri
    uri:  "/status/#{data.id}"
    url:  data.entities?.urls[0].url
    time: data.created_at
    text: data.text.slice(10).replace /^ http\S+/g, ""
    invalid: no

  [entry.lat, entry.lng] = data.geo.coordinates

  getDay entry.lat, entry.lng, (err, day, country) ->
    return console.log "invalid entry: #{err}" if err

    entry.country = country
    entry.day = day

    getPhoto entry.url, (err, data) ->
      return console.log "invalid entry: #{err}" if err

      entry.img = data.url
      entry.height = data.height
      entry.width = data.width
      entry.thumb = data.thumbnail_url
      entry.thumbWidth = data.thumbnail_width
      entry.thumbHeight = data.thumbnail_height
        
      entry.save (err, entry) ->
        console.log "new entry: #{entry.uri}"

onFollow = (data) ->
  user = new User
    uri:    "/users/#{data.id_str}"
    handle: data.screen_name.toLowerCase()
    name:   data.name
    img:    data.profile_image_url
    lang:   data.lang
    since:  new Date
    score:  0
    country: "Unknown"

  user.save (err, user) ->
    return console.log err if err

    console.log "new user: #{user.handle}"
    twitter.tweet(
      "@#{user.handle} Your #ramendan calendar is ready! http://ramendan.com/#{user.handle}"
      (err, data) -> console.log err or "confirmation sent to #{user.handle}."
    )

twitter = new Twitter
  consumer:
    key: "tcrzlUrmOHd6idGBYC4KTA"
    secret: "JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc"
  token:
    key: "315955679-zp64SIsgXwlW28qDEDt69APrql7u0AJFJFthJXoS"
    secret: "4BYQzGuK3dd5tNbo8orWwiFS9f7dZOATvz8MrLnrQ"

twitter.listen (data) ->
  isFollow = data.event is "follow"

  if isFollow
    return onFollow data.source

  (new User uri: "/users/#{data.user.id_str}").read (err, user) ->
    return if err

    isEntry = data.geo and
      data.in_reply_to_screen_name is "ramendan" and
      data.entities?.urls.length

    if isEntry
      console.log "new entry from #{user.handle}"
      return onEntry data

    isRetweet = data.retweeted_status?.user.screen_name is "ramendan"

    if isRetweet and not user.retweet
      console.log "new retweet from #{user.handle}"
      return user.attr "retweet", data.id, -> user.updateScore()

    isMention = not data.in_reply_to_screen_name and
      data.entities?.user_mentions?.some (x) -> x.screen_name is "ramendan"

    if isMention and not user.mention
      console.log "new mention from #{user.handle}"
      return user.attr "mention", data.id, -> user.updateScore()

    isHashtag = /#rAmen\.$/i.test data.text

    if isHashtag and not user.hashtag
      console.log "new hashtag from #{user.handle}"
      return user.attr "hashtag", data.id, -> user.updateScore()

estimateLocation = (data) ->
  if not data.geo?.coordinates and coords = data.place?.bounding_box?.coordinates[0]
    data.geo = coordinates: [
      (coords[0][1] + coords[2][1]) / 2
      (coords[0][0] + coords[2][0]) / 2
    ]
