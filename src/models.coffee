db      = require "./db"
{OAuth} = require "oauth"

exports.User = class User
  @top: (cb) ->
    db.zrevrange "/users", 0, 19, (err, list) ->
      i = list.length

      do run = ->
        return cb null, list unless i--
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
          today = (0 | new Date / 86400000) - 15185
          user.entries = ({day: num, future: num > today} for num in [0..29])
          keys = Object.keys props
          i = keys.length
          
          do run = ->
            return cb null, user unless i--
            (new Entry uri: props[i]).read (err, entry) ->
              user.entries[entry.day] = entry
              run()

  attr: (key, val, cb) ->
    db.hset @uri, key, val, cb or ->

  updateScore: (cb) ->
    db.hlen "#{@uri}/entries", (err, num) =>
      score = (num or 0) + 2 * (num is 30)
      db.hgetall @uri, (err, props) =>
        total = !!props.practice +
                !!props.mention +
                !!props.retweet +
                !!props.hashtag

        score += total * 2
        
        db.hset @uri, "score", score, cb or ->

  save: (cb) ->
    op = db.multi()

    op.hmset @uri , @
    op.zadd  "/users", @score, @uri
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

  tweet: (text, cb) ->
    @oa.post(
      "http://api.twitter.com/1/statuses/update.json"
      @token.key
      @token.secret
      status: text
      cb
    )
    
  listen: (cb) ->
    request = @oa.get(
      "https://userstream.twitter.com/2/user.json?track=%23rAmen."
      @token.key
      @token.secret
    )

    request.on "response", (response) ->
      console.log "connected to twitter."

      response.setEncoding "utf8"

      response.on "error", (err) ->
        console.log err

      response.on "data", (json) ->
        try cb JSON.parse json

      response.on "end", ->
        console.log "disconnected from twitter."

    request.end()

exports.Entry = class Entry
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
    if @day < 0 then @invalid = "beforeRamendan"
    else if @day > 30 then @invalid = "afterRamendan"
    else if err then @invalid = "beforeSunset"

    op = db.multi()

    if @invalid is "beforeRamendan"
      op.hset @user, "practice", @uri
      
    unless @invalid
      op.hset "#{@user}/entries", @day, @uri
      
    op.hmset @user, latest: @uri, country: @country

    delete @lat
    delete @lng

    op.lpush "/entries/latest", @uri
    op.ltrim "/entries/latest", 0, 19

    op.hmset @uri, @

    op.exec (err) =>
      (new User uri: @user).updateScore ->
      cb err, @
