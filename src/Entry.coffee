http = require "http"
db = require "./db"
User = require "./User"

{Api} = require "embedly"
embedly = new Api key: 'daf28dd296b811e0bc3c4040d3dc5c07'

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
      if obj?.type is "photo"
        @img = obj.url
        @height = obj.height
        @width = obj.width
        @thumb = obj.thumbnail_url
        @thumbWidth = obj.thumbnail_width
        @thumbHeight = obj.thumbnail_height

      else @invalid = "notPhoto"
      
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
            @invalid = "beforeSunset" unless dusk or dawn

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
    if @day < 0 then @invalid = "beforeRamendan"
    else if @day > 29 then @invalid = "afterRamendan"

    op = db.multi()

    unless @invalid
      op.hset "#{@user}/entries", @day, @uri
      
    op.hmset @user, latest: @uri, country: @countryName

    delete @lat
    delete @lng

    op.lpush "/entries/latest", @uri
    op.ltrim "/entries/latest", 0, 19

    op.hmset @uri, @

    op.exec (err) =>
      (new User uri: @user).updateScore ->
      cb err, @

module.exports = Entry