(function() {
  var EMBEDLY, Entry, PORT, TWITTER_ID, TWITTER_KEY, TWITTER_SECRET, TWITTER_TOKEN, TWITTER_TOKEN_SECRET, User, db, embedly, file, getDay, getPhoto, handlers, http, onEntry, onFollow, redis, server, static, twit, twitter, url;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  http = require("http");
  url = require("url");
  PORT = process.env.PORT || 5000;
  TWITTER_TOKEN = '315955679-zp64SIsgXwlW28qDEDt69APrql7u0AJFJFthJXoS';
  TWITTER_TOKEN_SECRET = '4BYQzGuK3dd5tNbo8orWwiFS9f7dZOATvz8MrLnrQ';
  TWITTER_KEY = 'tcrzlUrmOHd6idGBYC4KTA';
  TWITTER_SECRET = 'JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc';
  EMBEDLY = 'daf28dd296b811e0bc3c4040d3dc5c07';
  TWITTER_ID = 315955679;
  static = require("node-static");
  redis = require("redis");
  embedly = require("embedly");
  twitter = require("twitter");
  file = new static.Server("./public");
  db = redis.createClient();
  embedly = new embedly.Api({
    key: EMBEDLY
  });
  twit = new twitter({
    consumer_key: TWITTER_KEY,
    consumer_secret: TWITTER_SECRET,
    access_token_key: TWITTER_TOKEN,
    access_token_secret: TWITTER_TOKEN_SECRET
  });
  User = (function() {
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
  Entry = (function() {
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
      if (err) {
        return twit.updateStatus("@" + user.handle + " Sorry, but you're not a true follower yet. Follow @ramendan and try again.", function(err, data) {
          return console.log(err || ("got entry from non-follower: " + user.handle + "."));
        });
      } else {
        return getDay(entry.lat, entry.lng, function(err, day) {
          if (err) {
            return console.log("could not get valid day");
          }
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
            entry.thumbWidth = data.thumbnail_height;
            entry.thumbHeight = data.thumbnail_width;
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
          oa.post(
            "http://api.twitter.com/1/statuses/update.json"
            TWITTER_TOKEN
            TWITTER_TOKEN_SECRET
            status: "@#{user.handle} Your #ramendan calendar is ready! http://ramendan.com/#{user.handle}"
            (err, data) ->
              console.log err or "confirmation sent to #{user.handle}."
          )
          */
    });
  };
  twit.stream("user", function(stream) {
    return stream.on("data", function(data) {
      var coords, location, mention, uri, _ref, _ref2, _ref3, _ref4, _ref5;
      mention = data.in_reply_to_user_id === TWITTER_ID;
      location = (_ref = data.geo) != null ? _ref.coordinates : void 0;
      uri = (_ref2 = data.entities) != null ? (_ref3 = _ref2.urls) != null ? _ref3[0] : void 0 : void 0;
      if (!location && (coords = (_ref4 = data.place) != null ? (_ref5 = _ref4.bounding_box) != null ? _ref5.coordinates[0] : void 0 : void 0)) {
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
  handlers = [
    /^\/api$/, function(req, cb) {
      return Entry.latest(function(err, entries) {
        return User.latest(function(err, users) {
          return cb(null, {
            entries: entries,
            users: users
          });
        });
      });
    }, /^\/api\/users\/latest$/, function(req, cb) {
      return User.latest(cb);
    }, /^\/api\/users\/(\w+)$/, function(req, cb) {
      return db.hget("/handles", req.captures[1], function(err, uri) {
        if (!uri) {
          return cb(404);
        }
        return (new User({
          uri: uri
        })).readWithEntries(cb);
      });
    }, /^\/api\/entries\/latest$/, function(req, cb) {
      return Entry.latest(cb);
    }
  ];
  server = http.createServer(function(req, res) {
    var handler, index, path, pattern, uri;
    uri = url.parse(req.url, true);
    path = uri.pathname;
    index = 0;
    while (pattern = handlers[index++]) {
      handler = handlers[index++];
      if (req.captures = path.match(pattern)) {
        return handler(req, function(err, body) {
          var callback, _ref, _ref2;
          callback = (_ref = uri.query.callback) != null ? (_ref2 = _ref.match(/^\w+$/)) != null ? _ref2[0] : void 0 : void 0;
          body = "" + (callback || 'alert') + "(" + (JSON.stringify(body)) + ")";
          res.writeHead(200, {
            "Content-Length": Buffer.byteLength(body),
            "Content-Type": "text/javascript"
          });
          return res.end(body);
        });
      }
    }
    index = process.env.JOYENT ? "teaser" : "index";
    if (!~path.indexOf(".")) {
      req.url = "/" + index + ".html";
    }
    return file.serve(req, res);
  });
  server.listen(PORT, function() {
    return console.log("ramendan running on port " + PORT);
  });
}).call(this);
