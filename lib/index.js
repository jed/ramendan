(function() {
  var EMBEDLY, Entry, TWITTER_ID, TWITTER_KEY, TWITTER_SECRET, TWITTER_TOKEN, TWITTER_TOKEN_SECRET, Twitter, User, db, embedly, file, getDay, getPhoto, onEntry, onFollow, redis, static, twit, _ref;
  TWITTER_TOKEN = '315955679-zp64SIsgXwlW28qDEDt69APrql7u0AJFJFthJXoS';
  TWITTER_TOKEN_SECRET = '4BYQzGuK3dd5tNbo8orWwiFS9f7dZOATvz8MrLnrQ';
  TWITTER_KEY = 'tcrzlUrmOHd6idGBYC4KTA';
  TWITTER_SECRET = 'JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc';
  EMBEDLY = 'daf28dd296b811e0bc3c4040d3dc5c07';
  TWITTER_ID = 315955679;
  static = require("node-static");
  redis = require("redis");
  embedly = require("embedly");
  Twitter = require("twitter");
  db = require("./db");
  _ref = require("./models"), User = _ref.User, Entry = _ref.Entry;
  file = new static.Server("./public");
  embedly = new embedly.Api({
    key: EMBEDLY
  });
  twit = new Twitter({
    consumer_key: TWITTER_KEY,
    consumer_secret: TWITTER_SECRET,
    access_token_key: TWITTER_TOKEN,
    access_token_secret: TWITTER_TOKEN_SECRET
  });
  getPhoto = function(url, cb) {
    var req;
    req = embedly.oembed({
      url: url
    });
    req.on("complete", function(_arg) {
      var obj;
      obj = _arg[0];
      if ((obj != null ? obj.type : void 0) === "photo") {
        return cb(null, obj);
      } else {
        return cb("notPhoto");
      }
    });
    return req.start();
  };
  getDay = function(lat, lng, cb) {
    return http.get({
      host: "api.geonames.org",
      path: "/timezoneJSON?username=jed&lat=" + lat + "&lng=" + lng
    }, function(response) {
      var data;
      data = "";
      response.setEncoding("utf8");
      response.on("data", function(chunk) {
        return data += chunk;
      });
      return response.on("end", function() {
        var dawn, day, dusk, err, sunrise, sunset, time, _ref2;
        try {
          _ref2 = JSON.parse(data), sunrise = _ref2.sunrise, sunset = _ref2.sunset, time = _ref2.time;
          dusk = time > sunset;
          dawn = time < sunrise;
          day = time.split(" ")[0].replace(/-/g, "");
          err = dusk || dawn ? null : "notAfterSunset";
          return cb(err, day - dawn);
        } catch (e) {
          return cb(e);
        }
      });
    });
  };
  onEntry = function(data) {
    var entry, user, _ref2, _ref3;
    user = new User({
      uri: "/users/" + data.user.id_str,
      handle: data.user.screen_name
    });
    entry = new Entry({
      user: user.uri,
      url: (_ref2 = data.entities) != null ? _ref2.urls[0].url : void 0,
      time: data.created_at,
      text: data.text.slice(10),
      invalid: false
    });
    _ref3 = data.geo.coordinates, entry.lat = _ref3[0], entry.lng = _ref3[1];
    return user.read(function(err) {
      if (err) {
        return twit.updateStatus("@" + user.handle + " Sorry, but you're not a true follower yet. Follow @ramendan and try again.", function(err, data) {
          return console.log(err || ("got entry from non-follower: " + user.handle + "."));
        });
      } else {
        return getDay(entry.lat, entry.lng, function(err, day) {
          entry.uri = "" + user.uri + "/entries/" + day;
          if (day < 20110731 || day > 20110829) {
            entry.invalid = "notRamendan";
          }
          if (err) {
            entry.invalid || (entry.invalid = err);
          }
          return getPhoto(entry.url, function(err, data) {
            if (err) {
              entry.invalid || (entry.invalid = err);
            }
            entry.img = data.url;
            entry.height = data.height;
            entry.width = data.width;
            entry.thumb = data.thumbnail_url;
            entry.thumbWidth = data.thumbnail_width;
            entry.thumbHeight = data.thumbnail_height;
            return entry.save(function(err, entry) {
              return console.log("new entry: " + entry.uri + " - " + (entry.invalid || 'valid'));
            });
          });
        });
      }
    });
  };
  onFollow = function(data) {
    var user;
    user = new User({
      uri: "/users/" + data.source.id_str,
      handle: data.source.screen_name.toLowerCase(),
      name: data.source.name,
      img: data.source.profile_image_url,
      blurb: data.source.description,
      lang: data.source.lang,
      since: new Date
    });
    return user.save(function(err, user) {
      if (err) {
        return;
      }
      return console.log("new user: " + user.handle);
      /*
          twit.updateStatus(
            "@#{user.handle} Your #ramendan calendar is ready! http://ramendan.com/#{user.handle}"
            (err, data) -> console.log err or "confirmation sent to #{user.handle}."
          )
          */
    });
  };
  twit.stream("user", function(stream) {
    return stream.on("data", function(data) {
      var coords, location, mention, uri, _ref2, _ref3, _ref4, _ref5, _ref6;
      mention = data.in_reply_to_user_id === TWITTER_ID;
      location = (_ref2 = data.geo) != null ? _ref2.coordinates : void 0;
      uri = (_ref3 = data.entities) != null ? (_ref4 = _ref3.urls) != null ? _ref4[0] : void 0 : void 0;
      if (!location && (coords = (_ref5 = data.place) != null ? (_ref6 = _ref5.bounding_box) != null ? _ref6.coordinates[0] : void 0 : void 0)) {
        location = data.geo = {
          coordinates: [(coords[0][1] + coords[2][1]) / 2, (coords[0][0] + coords[2][0]) / 2]
        };
      }
      if (data.event === "follow") {
        return onFollow(data);
      } else if (mention && location && uri) {
        return onEntry(data);
      }
    });
  });
}).call(this);
