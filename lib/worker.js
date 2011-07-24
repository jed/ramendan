(function() {
  var Entry, Twitter, User, embedly, estimateLocation, getDay, getPhoto, http, onEntry, onFollow, twitter, _ref;
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
        var countryName, dawn, day, dusk, err, sunrise, sunset, time, _ref2;
        try {
          _ref2 = JSON.parse(data), sunrise = _ref2.sunrise, sunset = _ref2.sunset, time = _ref2.time, countryName = _ref2.countryName;
          dusk = time > sunset;
          dawn = time < sunrise;
          day = (0 | new Date(time) / 86400000) - 15185;
          err = dusk || dawn ? null : "notAfterSunset";
          return cb(err, day - dawn, countryName || "Somewhere");
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
      uri: "/status/" + data.id,
      url: (_ref2 = data.entities) != null ? _ref2.urls[0].url : void 0,
      time: data.created_at,
      text: data.text.slice(10).replace(/^ http\S+/g, ""),
      invalid: false
    });
    _ref3 = data.geo.coordinates, entry.lat = _ref3[0], entry.lng = _ref3[1];
    return getDay(entry.lat, entry.lng, function(err, day, country) {
      if (err) {
        return console.log("invalid entry: " + err);
      }
      entry.country = country;
      entry.day = day;
      return getPhoto(entry.url, function(err, data) {
        if (err) {
          return console.log("invalid entry: " + err);
        }
        entry.img = data.url;
        entry.height = data.height;
        entry.width = data.width;
        entry.thumb = data.thumbnail_url;
        entry.thumbWidth = data.thumbnail_width;
        entry.thumbHeight = data.thumbnail_height;
        return entry.save(function(err, entry) {
          return console.log("new entry: " + entry.uri);
        });
      });
    });
  };
  onFollow = function(data) {
    var user;
    user = new User({
      uri: "/users/" + data.id_str,
      handle: data.screen_name.toLowerCase(),
      name: data.name,
      img: data.profile_image_url,
      lang: data.lang,
      since: new Date,
      score: 0,
      country: "Unknown"
    });
    return user.save(function(err, user) {
      if (err) {
        return console.log(err);
      }
      console.log("new user: " + user.handle);
      return twitter.tweet("@" + user.handle + " Your #ramendan calendar is ready! http://ramendan.com/users/" + user.handle, function(err, data) {
        return console.log(err || ("confirmation sent to " + user.handle + "."));
      });
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
    var isFollow;
    isFollow = data.event === "follow";
    if (isFollow) {
      return onFollow(data.source);
    }
    return (new User({
      uri: "/users/" + data.user.id_str
    })).read(function(err, user) {
      var isEntry, isHashtag, isMention, isRetweet, _ref2, _ref3, _ref4, _ref5;
      if (err) {
        return;
      }
      isEntry = data.geo && data.in_reply_to_screen_name === "ramendan" && ((_ref2 = data.entities) != null ? _ref2.urls.length : void 0);
      if (isEntry) {
        console.log("new entry from " + user.handle);
        return onEntry(data);
      }
      isRetweet = ((_ref3 = data.retweeted_status) != null ? _ref3.user.screen_name : void 0) === "ramendan";
      if (isRetweet && !user.retweet) {
        console.log("new retweet from " + user.handle);
        return user.attr("retweet", data.id, function() {
          return user.updateScore();
        });
      }
      isMention = !data.in_reply_to_screen_name && ((_ref4 = data.entities) != null ? (_ref5 = _ref4.user_mentions) != null ? _ref5.some(function(x) {
        return x.screen_name === "ramendan";
      }) : void 0 : void 0);
      if (isMention && !user.mention) {
        console.log("new mention from " + user.handle);
        return user.attr("mention", data.id, function() {
          return user.updateScore();
        });
      }
      isHashtag = /#rAmen\.$/i.test(data.text);
      if (isHashtag && !user.hashtag) {
        console.log("new hashtag from " + user.handle);
        return user.attr("hashtag", data.id, function() {
          return user.updateScore();
        });
      }
    });
  });
  estimateLocation = function(data) {
    var coords, _ref2, _ref3, _ref4;
    if (!((_ref2 = data.geo) != null ? _ref2.coordinates : void 0) && (coords = (_ref3 = data.place) != null ? (_ref4 = _ref3.bounding_box) != null ? _ref4.coordinates[0] : void 0 : void 0)) {
      return data.geo = {
        coordinates: [(coords[0][1] + coords[2][1]) / 2, (coords[0][0] + coords[2][0]) / 2]
      };
    }
  };
}).call(this);
