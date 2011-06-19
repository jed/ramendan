db = require "./db"

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

exports.Tweet = class Tweet
  constructor: (attrs) ->
    @[key] = value for key, value of attrs

    console.log @
