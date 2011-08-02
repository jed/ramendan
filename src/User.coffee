db = require "./db"

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

module.exports = User