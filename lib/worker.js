(function() {
  var Entry, Twitter, User, action, getDay, http, id, onData, onEntry, onFollow, _ref, _ref2;
  http = require("http");
  _ref = require("./models"), Twitter = _ref.Twitter, User = _ref.User, Entry = _ref.Entry;
  _ref2 = process.argv.slice(2), action = _ref2[0], id = _ref2[1];
  getDay = function(lat, lng, date, cb) {
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
        var countryName, dawn, day, dusk, err, sunrise, sunset, time, _ref3;
        try {
          _ref3 = JSON.parse(data), sunrise = _ref3.sunrise, sunset = _ref3.sunset, countryName = _ref3.countryName;
          time = date.toTimeString();
          sunrise = (new Date(sunrise)).toTimeString();
          sunset = (new Date(sunset)).toTimeString();
          dusk = time > sunset;
          dawn = time < sunrise;
          day = (0 | date / 86400000) - 15186;
          err = dusk || dawn ? null : "notAfterSunset";
          err = null;
          return cb(err, day - dawn, countryName || "Somewhere");
        } catch (e) {
          return cb(e);
        }
      });
    });
  };
  onEntry = function(data) {
    var entry, user, _ref3, _ref4;
    console.log("incoming entry: /status/" + data.id);
    user = new User({
      uri: "/users/" + data.user.id_str,
      handle: data.user.screen_name
    });
    entry = new Entry({
      user: user.uri,
      uri: "/status/" + data.id,
      url: (_ref3 = data.entities) != null ? _ref3.urls[0].url : void 0,
      time: new Date(data.created_at),
      text: data.text.slice(10).replace(/^ http\S+/g, ""),
      invalid: false
    });
    _ref4 = data.geo.coordinates, entry.lat = _ref4[0], entry.lng = _ref4[1];
    return getDay(entry.lat, entry.lng, entry.time, function(err, day, country) {
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
      return twitter.tweet("@" + user.handle + " Your #ramendan calendar is ready! http://ramendan.com/" + user.handle, function(err, data) {
        return console.log(err || ("confirmation sent to " + user.handle + "."));
      });
    });
  };
  onData = function(data) {
    var isFollow;
    isFollow = data.event === "follow";
    if (isFollow) {
      return onFollow(data.source);
    }
    return (new User({
      uri: "/users/" + data.user.id_str
    })).read(function(err, user) {
      var isEntry, isHashtag, isMention, isRetweet, _ref3, _ref4, _ref5, _ref6;
      if (err) {
        return;
      }
      isEntry = data.geo && data.in_reply_to_screen_name === "ramendan" && ((_ref3 = data.entities) != null ? _ref3.urls.length : void 0);
      if (isEntry) {
        console.log("new entry from " + user.handle);
        return onEntry(data);
      }
      isRetweet = ((_ref4 = data.retweeted_status) != null ? _ref4.user.screen_name : void 0) === "ramendan";
      if (isRetweet && !user.retweet) {
        console.log("new retweet from " + user.handle);
        return user.attr("retweet", data.id, function() {
          return user.updateScore();
        });
      }
      isMention = !data.in_reply_to_screen_name && ((_ref5 = data.entities) != null ? (_ref6 = _ref5.user_mentions) != null ? _ref6.some(function(x) {
        return x.screen_name === "ramendan";
      }) : void 0 : void 0);
      if (isMention && !user.mention) {
        console.log("new mention from " + user.handle);
        return user.attr("mention", data.id, function() {
          return user.updateScore();
        });
      }
      isHashtag = /#rAmen\.?$/i.test(data.text);
      if (isHashtag && !user.hashtag) {
        console.log("new hashtag from " + user.handle);
        return user.attr("hashtag", data.id, function() {
          return user.updateScore();
        });
      }
    });
  };
  if (action === "entry") {
    twitter.getTweet(id, function(err, body) {
      body = JSON.parse(body);
      return onData(body);
    });
  } else {
    twitter.listen(onData);
  }
}).call(this);
