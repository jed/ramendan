(function() {
  var Entry, Twitter, User, embedly, getDay, getPhoto, http, onEntry, onFollow, twitter, _ref;
  http = require("http");
  _ref = require("./models"), Twitter = _ref.Twitter, User = _ref.User, Entry = _ref.Entry;
  embedly = require("embedly");
  embedly = new embedly.Api({
    key: 'daf28dd296b811e0bc3c4040d3dc5c07'
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
        return twitter.tweet("@" + user.handle + " Sorry, but you're not a true follower yet. Follow @ramendan and try again.", function(err, data) {
          return console.log(err || ("got entry from non-follower: " + user.handle + "."));
        });
      } else {
        return getDay(entry.lat, entry.lng, function(err, day) {
          entry.uri = "" + user.uri + "/entries/" + day;
          if (day < 20110731) {
            entry.invalid = "beforeRamendan";
          }
          if (day > 20110829) {
            entry.invalid || (entry.invalid = "afterRamendan");
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
        return console.log(err);
      }
      return console.log("new user: " + user.handle);
      /*
          twitter.tweet(
            "@#{user.handle} Your #ramendan calendar is ready! http://ramendan.com/#{user.handle}"
            (err, data) -> console.log err or "confirmation sent to #{user.handle}."
          )
          */
    });
  };
  twitter = new Twitter({
    consumer: {
      key: "tcrzlUrmOHd6idGBYC4KTA",
      secret: "JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc"
    },
    token: {
      key: "315955679-zp64SIsgXwlW28qDEDt69APrql7u0AJFJFthJXoS",
      secret: "4BYQzGuK3dd5tNbo8orWwiFS9f7dZOATvz8MrLnrQ"
    }
  });
  twitter.listen(function(data) {
    var coords, isHashtag, isMention, isReply, isRetweet, location, uri, _ref10, _ref11, _ref12, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9;
    console.log(data, (_ref2 = data.entities) != null ? _ref2.user_mentions : void 0);
    isReply = data.in_reply_to_screen_name === "ramendan";
    isHashtag = /#ramen\.$/.test(data.text);
    isMention = !data.in_reply_to_screen_name && ((_ref3 = data.entities) != null ? (_ref4 = _ref3.user_mentions) != null ? _ref4.some(function(x) {
      return x.screen_name === "ramendan";
    }) : void 0 : void 0);
    isRetweet = ((_ref5 = data.retweeted_status) != null ? _ref5.user.screen_name : void 0) === "ramendan";
    location = (_ref6 = data.geo) != null ? _ref6.coordinates : void 0;
    uri = (_ref7 = data.entities) != null ? (_ref8 = _ref7.urls) != null ? _ref8[0] : void 0 : void 0;
    if (!location && (coords = (_ref9 = data.place) != null ? (_ref10 = _ref9.bounding_box) != null ? _ref10.coordinates[0] : void 0 : void 0)) {
      location = data.geo = {
        coordinates: [(coords[0][1] + coords[2][1]) / 2, (coords[0][0] + coords[2][0]) / 2]
      };
    }
    if (data.event === "follow") {
      return onFollow(data);
    } else if (isReply && location && uri) {
      return onEntry(data);
    } else if (/#ramen\.$/.test(data.text)) {
      return onHashtag(data);
    } else if (!data.in_reply_to_screen_name && ((_ref11 = data.entities) != null ? (_ref12 = _ref11.user_mentions) != null ? _ref12.some : void 0 : void 0)) {
      return onMention(data);
    }
  });
}).call(this);
