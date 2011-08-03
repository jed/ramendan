db = require "./db"
http = require "http"

{OAuth} = require "oauth"
{Api} = require "embedly"

embedly = new Api(key: 'daf28dd296b811e0bc3c4040d3dc5c07')

credentials = 
  consumer:
    key: "tcrzlUrmOHd6idGBYC4KTA"
    secret: "JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc"
  token:
    key: "315955679-zp64SIsgXwlW28qDEDt69APrql7u0AJFJFthJXoS"
    secret: "4BYQzGuK3dd5tNbo8orWwiFS9f7dZOATvz8MrLnrQ"

oa = new OAuth(
  "https://twitter.com/oauth/request_token"
  "https://twitter.com/oauth/access_token"
  credentials.consumer.key
  credentials.consumer.secret
  "1.0A"
  null
  "HMAC-SHA1"
)

class Entry
  @latest: (cb) ->
    db.lrange "/entries/latest", 0, -1, (err, list = []) ->
      i = list.length

      do run = ->
        return cb null, list unless i--
        (new Entry uri: list[i]).readWithUser (err, entry) ->
          list[i] = entry; run()

  process: (cb) ->
    @getPhoto (err) =>
      if err or @invalid then cb err
      else @getGeo cb

  getPhoto: (cb) ->
    req = embedly.oembed url: @url

    req.on "complete", ([obj]) =>
      @img = obj.url
      @height = obj.height
      @width = obj.width
      @thumb = obj.thumbnail_url
      @thumbWidth = obj.thumbnail_width
      @thumbHeight = obj.thumbnail_height
      
      cb null

    req.start()

  getGeo: (cb) ->
    http.get
      host: "api.geonames.org"
      path: "/timezoneJSON?username=jed&lat=#{@lat}&lng=#{@lng}"

      (res) =>
        data = ""
        res.setEncoding "utf8"
        res.on "data", (chunk) -> data += chunk
        res.on "end", =>
          try
            data = JSON.parse data

            {dstOffset, sunrise, sunset, @countryName} = data

            local = new Date +@time + dstOffset * 36e5
            @day = (0 | local / 86400000) - 15186

            sunrise = sunrise.slice -5
            sunset = sunset.slice -5
            time = local.toUTCString().slice -12, -7

            dawn = time <= sunrise
            dusk = time >= sunset

            @day-- if dawn
            @invalid = "#{time} is before #{sunset}" unless dusk or dawn

            cb null

          catch e then cb e

  constructor: (attrs) ->
    @[key] = value for key, value of attrs

  read: (cb) ->
    db.exists @uri, (err, exists) =>
      if err then cb message: err
      else if not exists then cb status: 404, message: "Not found."
      else db.hgetall @uri, (err, props) ->
        props.day = +props.day

        {thumbWidth, thumbHeight} = props
        ratio = thumbWidth / thumbHeight
        
        if ratio < 1
          thumbWidth = 133
          thumbHeight = 133 / ratio

        else if ratio > 1
          thumbHeight = 133
          thumbWidth = 133 / ratio
          
        else thumbHeight = thumbWidth = 133
        
        props.thumbWidth = thumbWidth
        props.thumbHeight = thumbHeight
        
        if err then cb message: err
        else cb null, new Entry props

  readWithUser: (cb) ->
    @read (err, entry) ->
      return cb err if err

      (new User uri: entry.user).read (err, user) ->
        entry.user = user
        cb err, entry

  save: (cb) ->
    if @day < 0
      @invalid = "beforeRamendan"

    else if @day > 29
      @invalid = "afterRamendan"

    op = db.multi()

    if @invalid
      console.log "#{@uri} is invalid: #{@invalid}"
    else
      op.hset "#{@user}/entries", @day, @uri
      
    op.hmset @user, latest: @uri, country: @countryName

    delete @lat
    delete @lng

    op.lpush "/entries/latest", @uri
    op.ltrim "/entries/latest", 0, 19

    op.hmset @uri, @

    op.exec (err) =>
      (new User uri: @user).updateScore (err) =>
        cb err, @

class Tweet
  @listen: ->
    request = oa.get(
      "https://userstream.twitter.com/2/user.json?track=%23rAmen."
      credentials.token.key
      credentials.token.secret
    )

    request.on "response", (response) =>
      console.log "listening for tweets..."

      response.setEncoding "utf8"

      response.on "error", (err) =>
        console.log err
        setTimeout (=> @listen cb), 5000

      response.on "data", (json) =>
        try (new Tweet JSON.parse json).process()

      response.on "end", =>
        console.log "disconnected from twitter."
        setTimeout (=> @listen cb), 5000

    request.end()

  constructor: (attrs) ->
    @[key] = value for key, value of attrs

  parse: (json, cb) ->
    try
      data = JSON.parse json
      @[key] = value for key, value of data
      cb null, @

    catch err
      cb err

  send: (cb) ->
    oa.post(
      "http://api.twitter.com/1/statuses/update.json"
      credentials.token.key
      credentials.token.secret
      status: @text
      cb
    )

  fetch: (cb) ->
    oa.get(
      "http://api.twitter.com/1/statuses/show.json?id=#{@id_str}&include_entities=1"
      credentials.token.key
      credentials.token.secret
      (err, data) =>
        if err then cb err
        else @parse data, cb
    )

  isFollow: ->
    @event is "follow"

  isEntry: ->
    @geo and
    @in_reply_to_screen_name is "ramendan" and
    @entities?.urls.length

  isRetweet: ->
    @retweeted_status?.user.screen_name is "ramendan"

  isMention: ->
    not @in_reply_to_screen_name and
    @entities?.user_mentions?.some (x) -> x.screen_name is "ramendan"

  isHashtag: ->
    /#rAmen\.?$/i.test @text

  onEntry: (cb) ->
    user = new User
      uri: "/users/#{@user.id_str}"
      handle: @user.screen_name

    entry = new Entry
      user: user.uri
      uri:  "/status/#{@id_str}"
      url:  @entities?.urls[0].url
      time: new Date @created_at
      text: @text.slice(10).replace /^ http\S+/g, ""
      invalid: no

    [entry.lat, entry.lng] = @geo.coordinates

    entry.process (err) ->
      if err
        console.log "entry is invalid: #{entry.invalid}"
        cb null

      else entry.save ->
        console.log "entry is valid: #{entry.uri}"
        cb null
  
  onFollow: (cb) ->
    user = new User
      uri:    "/users/#{@source.id_str}"
      handle: @source.screen_name.toLowerCase()
      name:   @source.name
      img:    @source.profile_image_url
      lang:   @source.lang
      since:  new Date
      score:  0
      country: "Unknown"

    user.save (err, user) ->
      return console.log err if err

      console.log "new user: #{user.handle}"

      tweet = new Tweet text: "@#{user.handle} Your #ramendan calendar is ready! http://ramendan.com/#{user.handle}"

      tweet.send (err, data) ->
        console.log err or "confirmation sent to #{user.handle}."
        cb null

  process: (cb) ->
    if @isFollow() then @onFollow cb

    else (new User uri: "/users/#{@user.id_str}").read (err, user) =>
      if err then return

      else if @isEntry()
        console.log "new entry from #{user.handle}"
        @onEntry cb

      else if @isRetweet() and not user.retweet
        console.log "new retweet from #{user.handle}"
        user.attr "retweet", @id_str, -> user.updateScore cb

      else if @isMention() and not user.mention
        console.log "new mention from #{user.handle}"
        user.attr "mention", @id_str, -> user.updateScore cb

      else if @isHashtag() and not user.hashtag
        console.log "new hashtag from #{user.handle}"
        user.attr "hashtag", @id_str, -> user.updateScore cb

      else
        console.log "not sure how to handle #{@id_str}"
        cb null

class User
  @top: (cb) ->
    db.zrevrange "/users", 0, 19, (err, list) ->
      i = list.length

      do run = ->
        unless i--
          return cb null, list

        (new User uri: list[i]).read (err, user) ->
          list[i] = user; run()

  @fromHandle: (handle, cb) ->
    db.hget "/handles", handle, (err, uri) ->
      if uri
        cb null, new User uri: uri
      else
        cb 404

  constructor: (attrs) ->
    @[key] = value for key, value of attrs

  fetch: (cb) ->
    oa.get(
      "http://api.twitter.com/1/users/show.json?screen_name=#{@handle}"
      credentials.token.key
      credentials.token.secret
      (err, data) =>
        if err then cb err
        else cb JSON.parse data
    )

  read: (cb) ->
    db.exists @uri, (err, exists) =>
      if err then cb message: err
      else if not exists then cb status: 404, message: "Not found."
      else db.hgetall @uri, (err, props) ->
        if err then cb message: err
        else cb null, new User props

  readWithEntries: (cb) ->
    @read (err, user) ->
      return cb err if err

      (new Entry uri: user.latest).read (err, entry) ->
        user.latest = entry if entry

        db.hgetall "#{user.uri}/entries", (err, props) ->
          today = (0 | new Date / 86400000) - 15186
          user.entries = ({day: num, future: num >= today} for num in [0..29])
          keys = Object.keys props
          i = 30

          do run = ->
            return cb null, user unless i--

            (new Entry uri: props[i]).read (err, entry) ->
              if entry then user.entries[entry.day] = entry
              run()

  attr: (key, val, cb) ->
    db.hset @uri, key, val, cb or ->

  updateScore: (cb) ->
    db.hlen "#{@uri}/entries", (err, num) =>
      score = 3 * (num or 0) + (2 * (num is 30))
      db.hgetall @uri, (err, props) =>
        total = !!props.practice +
                !!props.mention +
                !!props.retweet +
                !!props.hashtag

        score += (total * 2)
        
        op = db.multi()

        op.hset @uri, "score", score
        op.zadd "/users", score, @uri

        op.exec cb

  save: (cb) ->
    op = db.multi()

    op.hmset @uri , @
    op.zadd  "/users", @score, @uri
    op.hset  "/handles", @handle , @uri

    op.exec (err) => cb err, @

exports.User = User
exports.Entry = Entry
exports.Tweet = Tweet