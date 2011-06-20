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

  getDay entry.lat, entry.lng, (err, day) ->
    entry.uri = "#{user.uri}/entries/#{day}"
    entry.invalid = "beforeRamendan" if day < 20110731
    entry.invalid ||= "afterRamendan" if day > 20110829
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
    uri:    "/users/#{data.id_str}"
    handle: data.screen_name.toLowerCase()
    name:   data.name
    img:    data.profile_image_url
    blurb:  data.description
    lang:   data.lang
    since:  new Date

  user.save (err, user) ->
    return console.log err if err

    console.log "new user: #{user.handle}"
    ###
    twitter.tweet(
      "@#{user.handle} Your #ramendan calendar is ready! http://ramendan.com/#{user.handle}"
      (err, data) -> console.log err or "confirmation sent to #{user.handle}."
    )
    ###

onHashtag = (data) ->
  user.attr "hashtag", data.id

onMention = (data) ->
  user.attr "mention", data.id

onReTweet = (data) ->
  user.attr "retweet", data.id

onPractice = (data) ->
  user.attr "practice", data.id

twitter = new Twitter
  consumer:
    key: "tcrzlUrmOHd6idGBYC4KTA"
    secret: "JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc"
  token:
    key: "315955679-zp64SIsgXwlW28qDEDt69APrql7u0AJFJFthJXoS"
    secret: "4BYQzGuK3dd5tNbo8orWwiFS9f7dZOATvz8MrLnrQ"

twitter.listen (data) ->
  console.log data, data.entities?.user_mentions

  return onFollow data.source if data.event is "follow"

  (new User uri: "/users/#{data.user.id_str}").read (err, user) ->
    return if err

    return onEntry data if data.geo and
      data.in_reply_to_screen_name is "ramendan" and
      data.entities?.urls.length

    return onMention data if /#rAmen\.$/.test data.text

  isHashtag =
      

  isMention =
    not data.in_reply_to_screen_name and
    data.entities?.user_mentions?.some (x) -> x.screen_name is "ramendan"

  isRetweet =
    data.retweeted_status?.user.screen_name is "ramendan"

  #weed out all non-followers

  else if isReply and data.geo and uri then onEntry data

  else if /#ramen\.$/.test data.text then onHashtag data

  else if not data.in_reply_to_screen_name and data.entities?.user_mentions?.some then onMention data

estimateLocation = (data) ->
  if not data.geo?.coordinates and coords = data.place?.bounding_box?.coordinates[0]
    data.geo = coordinates: [
      (coords[0][1] + coords[2][1]) / 2
      (coords[0][0] + coords[2][0]) / 2
    ]
