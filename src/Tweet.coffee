{OAuth} = require "oauth"
User = require "./User"
Entry = require "./Entry"

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

Tweet = class Tweet
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

module.exports = Tweet