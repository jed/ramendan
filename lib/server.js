(function() {
  var EMBEDLY, Entry, Follower, OAuth, PORT, REDISTOGO_URL, TWITTER_ID, TWITTER_KEY, TWITTER_SECRET, TWITTER_TOKEN, TWITTER_TOKEN_SECRET, connectStream, db, embedly, env, file, getDay, getPhotoUrl, handlers, http, oa, onEntry, onEvent, onFollow, redis, redisUrl, server, static, url;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  http = require("http");
  url = require("url");
  static = require("node-static");
  redis = require("redis");
  OAuth = require("oauth").OAuth;
  embedly = require("embedly");
  env = (function() {
    try {
      return require("./env");
    } catch (e) {
      return process.env;
    }
  })();
  TWITTER_TOKEN = env.TWITTER_TOKEN, TWITTER_TOKEN_SECRET = env.TWITTER_TOKEN_SECRET, TWITTER_KEY = env.TWITTER_KEY, TWITTER_SECRET = env.TWITTER_SECRET, TWITTER_ID = env.TWITTER_ID, REDISTOGO_URL = env.REDISTOGO_URL, EMBEDLY = env.EMBEDLY, PORT = env.PORT;
  embedly = new embedly.Api({
    key: EMBEDLY
  });
  redisUrl = url.parse(REDISTOGO_URL);
  redisUrl.auth = (redisUrl.auth.split(":"))[1];
  db = redis.createClient(redisUrl.port, redisUrl.hostname);
  db.auth(redisUrl.auth);
  file = new static.Server("./public");
  oa = new OAuth("https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token", TWITTER_KEY, TWITTER_SECRET, "1.0A", "http://localhost:3000/oauth/callback", "HMAC-SHA1");
  Follower = (function() {
    Follower.latest = function(cb) {
      return db.zrevrange("/followers", 0, 19, function(err, list) {
        var i, run;
        i = list.length;
        return (run = function() {
          if (!i--) {
            return cb(null, list);
          }
          return (new Follower({
            id: list[i]
          })).read(function(err, user) {
            list[i] = user;
            return run();
          });
        })();
      });
    };
    function Follower(attrs) {
      var key, value;
      for (key in attrs) {
        value = attrs[key];
        this[key] = value;
      }
    }
    Follower.prototype.read = function(cb) {
      var uri;
      uri = "/followers/" + this.id;
      return db.exists(uri, function(err, exists) {
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
          return db.hgetall(uri, function(err, props) {
            var follower;
            if (err) {
              return cb({
                message: err
              });
            } else {
              follower = new Follower(props);
              return db.zrange("" + uri + "/entries", 0, -1, function(err, list) {
                follower.entries = list;
                return cb(null, follower);
              });
            }
          });
        }
      });
    };
    Follower.prototype.save = function(cb) {
      var op;
      op = db.multi();
      op.zadd("/followers", +new Date(this.since), this.id);
      op.hmset("/followers/" + this.id, this);
      op.hset("/handles", this.handle, this.id);
      return op.exec(__bind(function(err) {
        return cb(err, this);
      }, this));
    };
    return Follower;
  })();
  Entry = (function() {
    Entry.latest = function(cb) {
      return db.zrevrange("/entries", 0, 19, function(err, list) {
        var i, run;
        i = list.length;
        return (run = function() {
          if (!i--) {
            return cb(null, list);
          }
          return (new Entry({
            id: list[i]
          })).read(function(err, entry) {
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
      var uri;
      uri = "/entries/" + this.id;
      return db.exists(uri, function(err, exists) {
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
          return db.hgetall(uri, function(err, props) {
            if (err) {
              return cb({
                message: err
              });
            } else {
              return cb(null, new Entry(props));
            }
          });
        }
      });
    };
    Entry.prototype.save = function(cb) {
      var op;
      op = db.multi();
      if (!this.invalid) {
        op.zadd("/entries", +new Date(this.time), this.id);
      }
      op.hmset("/entries/" + this.id, this);
      op.zadd("/followers/" + this.user + "/entries", this.day, this.id);
      return op.exec(__bind(function(err) {
        return cb(err, this);
      }, this));
    };
    return Entry;
  })();
  getPhotoUrl = function(url, cb) {
    var req;
    req = embedly.oembed({
      url: url
    });
    req.on("complete", function(_arg) {
      var obj;
      obj = _arg[0];
      if ((obj != null ? obj.type : void 0) === "photo") {
        return cb(null, obj.url);
      } else {
        return cb("not_a_photo");
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
          err = dusk || dawn ? null : "not_after_sunset";
          return cb(err, day - dawn);
        } catch (e) {
          return cb(e);
        }
      });
    });
  };
  onEntry = function(data) {
    var entry, lat, lng, _ref, _ref2;
    _ref = data.geo.coordinates, lat = _ref[0], lng = _ref[1];
    entry = new Entry({
      id: data.id_str,
      user: data.user.id_str,
      lat: lat,
      lng: lng,
      url: (_ref2 = data.entities) != null ? _ref2.urls[0].url : void 0,
      time: data.created_at,
      invalid: false
    });
    return (new Follower({
      id: entry.id
    })).read(function(err, follower) {
      if (err) {
        return oa.post("http://api.twitter.com/1/statuses/update.json", TWITTER_TOKEN, TWITTER_TOKEN_SECRET, {
          status: "@" + follower.handle + " Sorry, you need to be a @ramendan follower to play. Try again."
        }, function(err, data) {
          return console.log(err || ("got entry from non-follower: " + follower.handle + "."));
        });
      } else {
        return getDay(lat, lng, function(err, day) {
          entry.day = day;
          if (err) {
            entry.invalid = err;
          }
          return getPhotoUrl(entry.url, function(err, url) {
            if (err) {
              entry.invalid || (entry.invalid = err);
            }
            entry.img = url;
            return entry.save(function(err, entry) {
              return console.log("new entry: " + entry.id + " - " + (entry.invalid || 'valid'));
            });
          });
        });
      }
    });
  };
  onFollow = function(data) {
    var follower;
    follower = new Follower({
      id: data.source.id_str,
      handle: data.source.screen_name,
      name: data.source.name,
      img: data.source.profile_image_url,
      blurb: data.source.description,
      lang: data.source.lang,
      since: data.source.created_at
    });
    return follower.save(function(err, follower) {
      if (err) {
        return;
      }
      console.log("new follower: " + follower.handle);
      return oa.post("http://api.twitter.com/1/statuses/update.json", TWITTER_TOKEN, TWITTER_TOKEN_SECRET, {
        status: "@" + follower.handle + " Your #ramendan calendar is ready! http://ramendan.com/" + follower.handle
      }, function(err, data) {
        return console.log(err || ("confirmation sent to " + follower.handle + "."));
      });
    });
  };
  onEvent = function(data) {
    var _ref;
    if (data == null) {
      return;
    }
    if (data.in_reply_to_user_id === TWITTER_ID && data.geo && ((_ref = data.entities) != null ? _ref.urls.length : void 0)) {
      return onEntry(data);
    } else if (data.event === "follow") {
      return onFollow(data);
    }
  };
  (connectStream = function() {
    var request;
    console.log("connecting to twitter...");
    request = oa.get("https://userstream.twitter.com/2/user.json", TWITTER_TOKEN, TWITTER_TOKEN_SECRET);
    request.addListener("response", function(res) {
      console.log("connected to twitter.");
      res.setEncoding("utf8");
      res.addListener("data", function(chunk) {
        console.log(chunk);
        return onEvent((function() {
          try {
            return JSON.parse(chunk);
          } catch (_e) {}
        })());
      });
      return res.addListener("end", function(data) {
        console.log("disconnected from twitter.", data);
        return setTimeout(connectStream, 5000);
      });
    });
    return request.end();
  })();
  handlers = [
    /^\/api\/followers\/latest$/, function(req, cb) {
      return Follower.latest(cb);
    }, /^\/api\/followers\/(\w+)$/, function(req, cb) {
      return db.hget("/handles", req.captures[1], function(err, id) {
        if (!id) {
          return cb(404);
        }
        return (new Follower({
          id: id
        })).read(cb);
      });
    }, /^\/api\/entries\/latest$/, function(req, cb) {
      return Entry.latest(cb);
    }, /^\/api\/entries\/(\d+)$/, function(req, cb) {
      return (new Entry({
        id: req.captures[1]
      })).read(cb);
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
    return file.serve(req, res);
  });
  server.listen(PORT, function() {
    return console.log("ramendan running on port " + PORT);
  });
}).call(this);
