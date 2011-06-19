(function() {
  var Entry, OAuth, Tweet, Twitter, User, db, embedly, getDay, getPhoto, onEntry, onFollow;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  };
  db = require("./db");
  OAuth = require("oauth").OAuth;
  embedly = require("embedly");
  embedly = new embedly.Api({
    key: 'daf28dd296b811e0bc3c4040d3dc5c07'
  });
  exports.User = User = (function() {
    User.latest = function(cb) {
      return db.zrevrange("/users", 0, 19, function(err, list) {
        var i, run;
        i = list.length;
        return (run = function() {
          if (!i--) {
            return cb(null, list);
          }
          return (new User({
            uri: list[i]
          })).read(function(err, user) {
            list[i] = user;
            return run();
          });
        })();
      });
    };
    function User(attrs) {
      var key, value;
      for (key in attrs) {
        value = attrs[key];
        this[key] = value;
      }
    }
    User.prototype.read = function(cb) {
      return db.exists(this.uri, __bind(function(err, exists) {
        if (err) {
          return cb({
            message: err
          });
        } else if (!exists) {
          return cb({
            status: 404,
            message: "Not found."
          });
        } else {
          return db.hgetall(this.uri, function(err, props) {
            if (err) {
              return cb({
                message: err
              });
            } else {
              return cb(null, new User(props));
            }
          });
        }
      }, this));
    };
    User.prototype.readWithEntries = function(cb) {
      return this.read(function(err, user) {
        return db.smembers("" + user.uri + "/entries", function(err, list) {
          var i, run;
          i = list.length;
          user.entries = list;
          return (run = function() {
            if (!i--) {
              return cb(null, user);
            }
            return (new Entry({
              uri: list[i]
            })).read(function(err, entry) {
              list[i] = entry;
              return run();
            });
          })();
        });
      });
    };
    User.prototype.save = function(cb) {
      var op;
      op = db.multi();
      op.hmset(this.uri, this);
      op.zadd("/users", +new Date(this.since), this.uri);
      op.hset("/handles", this.handle, this.uri);
      return op.exec(__bind(function(err) {
        return cb(err, this);
      }, this));
    };
    return User;
  })();
  exports.Twitter = Twitter = (function() {
    function Twitter(attrs) {
      var key, value;
      for (key in attrs) {
        value = attrs[key];
        this[key] = value;
      }
      this.oa = new OAuth("https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token", this.consumer.key, this.consumer.secret, "1.0A", null, "HMAC-SHA1");
    }
    Twitter.prototype.listen = function(cb) {
      var request;
      request = this.oa.get("https://userstream.twitter.com/2/user.json", this.token.key, this.token.secret);
      request.on("response", function(response) {
        console.log("connected to twitter.");
        response.setEncoding("utf8");
        response.on("data", function(json) {
          try {
            return cb(Tweet.create(JSON.parse(json)));
          } catch (_e) {}
        });
        return response.on("end", function() {
          return console.log("disconnected from twitter.");
        });
      });
      return request.end();
    };
    return Twitter;
  })();
  exports.Tweet = Tweet = (function() {
    Tweet.create = function(obj) {
      var coords, isReply, location, uri, _ref, _ref2, _ref3, _ref4, _ref5;
      isReply = data.in_reply_to_screen_name === "ramendan";
      location = (_ref = data.geo) != null ? _ref.coordinates : void 0;
      uri = (_ref2 = data.entities) != null ? (_ref3 = _ref2.urls) != null ? _ref3[0] : void 0 : void 0;
      if (!location && (coords = (_ref4 = data.place) != null ? (_ref5 = _ref4.bounding_box) != null ? _ref5.coordinates[0] : void 0 : void 0)) {
        location = data.geo = {
          coordinates: [(coords[0][1] + coords[2][1]) / 2, (coords[0][0] + coords[2][0]) / 2]
        };
      }
      if (data.event === "follow") {
        return onFollow(data);
      } else if (isReply && location && uri) {
        return onEntry(data);
      }
    };
    function Tweet(attrs) {
      var key, value;
      for (key in attrs) {
        value = attrs[key];
        this[key] = value;
      }
    }
    Tweet.prototype.save = function() {};
    return Tweet;
  })();
  exports.Entry = Entry = (function() {
    __extends(Entry, Tweet);
    Entry.latest = function(cb) {
      return db.lrange("/entries/latest", 0, -1, function(err, list) {
        var i, run;
        if (list == null) {
          list = [];
        }
        i = list.length;
        return (run = function() {
          if (!i--) {
            return cb(null, list);
          }
          return (new Entry({
            uri: list[i]
          })).readWithUser(function(err, entry) {
            list[i] = entry;
            return run();
          });
        })();
      });
    };
    function Entry(attrs) {
      var key, value;
      for (key in attrs) {
        value = attrs[key];
        this[key] = value;
      }
    }
    Entry.prototype.read = function(cb) {
      return db.exists(this.uri, __bind(function(err, exists) {
        if (err) {
          return cb({
            message: err
          });
        } else if (!exists) {
          return cb({
            status: 404,
            message: "Not found."
          });
        } else {
          return db.hgetall(this.uri, function(err, props) {
            if (err) {
              return cb({
                message: err
              });
            } else {
              return cb(null, new Entry(props));
            }
          });
        }
      }, this));
    };
    Entry.prototype.readWithUser = function(cb) {
      return this.read(function(err, entry) {
        if (err) {
          return cb(err);
        }
        return (new User({
          uri: entry.user
        })).read(function(err, user) {
          entry.user = user;
          return cb(err, entry);
        });
      });
    };
    Entry.prototype.save = function(cb) {
      var op;
      op = db.multi();
      op.sadd("" + this.user + "/entries", this.uri);
      op.lpush("/entries/latest", this.uri);
      op.ltrim("/entries/latest", 0, 19);
      op.hmset(this.uri, this);
      return op.exec(__bind(function(err) {
        return cb(err, this);
      }, this));
    };
    return Entry;
  })();
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
        var dawn, day, dusk, err, sunrise, sunset, time, _ref;
        try {
          _ref = JSON.parse(data), sunrise = _ref.sunrise, sunset = _ref.sunset, time = _ref.time;
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
    var entry, user, _ref, _ref2;
    user = new User({
      uri: "/users/" + data.user.id_str,
      handle: data.user.screen_name
    });
    entry = new Entry({
      user: user.uri,
      url: (_ref = data.entities) != null ? _ref.urls[0].url : void 0,
      time: data.created_at,
      text: data.text.slice(10),
      invalid: false
    });
    _ref2 = data.geo.coordinates, entry.lat = _ref2[0], entry.lng = _ref2[1];
    return user.read(function(err) {
      /*
          if err then twit.updateStatus(
            "@#{user.handle} Sorry, but you're not a true follower yet. Follow @ramendan and try again."
            (err, data) -> console.log err or "got entry from non-follower: #{user.handle}."
          )
          */      return getDay(entry.lat, entry.lng, function(err, day) {
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
}).call(this);
