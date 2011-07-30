(function() {
  var Entry, OAuth, Twitter, User, db;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  db = require("./db");
  OAuth = require("oauth").OAuth;
  exports.User = User = (function() {
    User.top = function(cb) {
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
    User.fromHandle = function(handle, cb) {
      return db.hget("/handles", handle, function(err, uri) {
        if (uri) {
          return cb(null, new User({
            uri: uri
          }));
        } else {
          return cb(404);
        }
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
        if (err) {
          return cb(err);
        }
        return (new Entry({
          uri: user.latest
        })).read(function(err, entry) {
          if (entry) {
            user.latest = entry;
          }
          return db.hgetall("" + user.uri + "/entries", function(err, props) {
            var i, keys, num, run, today;
            today = (0 | new Date / 86400000) - 15185;
            user.entries = (function() {
              var _results;
              _results = [];
              for (num = 0; num <= 29; num++) {
                _results.push({
                  day: num,
                  future: num >= today
                });
              }
              return _results;
            })();
            keys = Object.keys(props);
            i = keys.length;
            return (run = function() {
              if (!i--) {
                return cb(null, user);
              }
              return (new Entry({
                uri: props[i]
              })).read(function(err, entry) {
                user.entries[entry.day] = entry;
                return run();
              });
            })();
          });
        });
      });
    };
    User.prototype.attr = function(key, val, cb) {
      return db.hset(this.uri, key, val, cb || function() {});
    };
    User.prototype.updateScore = function(cb) {
      return db.hlen("" + this.uri + "/entries", __bind(function(err, num) {
        var score;
        score = 3 * (num || 0) + (2 * (num === 30));
        return db.hgetall(this.uri, __bind(function(err, props) {
          var op, total;
          total = !!props.practice + !!props.mention + !!props.retweet + !!props.hashtag;
          score += total * 2;
          op = db.multi();
          op.hset(this.uri, "score", score);
          op.zadd("/users", score, this.uri);
          return op.exec(cb);
        }, this));
      }, this));
    };
    User.prototype.save = function(cb) {
      var op;
      op = db.multi();
      op.hmset(this.uri, this);
      op.zadd("/users", this.score, this.uri);
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
    Twitter.prototype.tweet = function(text, cb) {
      return this.oa.post("http://api.twitter.com/1/statuses/update.json", this.token.key, this.token.secret, {
        status: text
      }, cb);
    };
    Twitter.prototype.listen = function(cb) {
      var request;
      request = this.oa.get("https://userstream.twitter.com/2/user.json?track=%23rAmen.", this.token.key, this.token.secret);
      request.on("response", __bind(function(response) {
        console.log("connected to twitter.");
        response.setEncoding("utf8");
        response.on("error", __bind(function(err) {
          console.log(err);
          return setTimeout((__bind(function() {
            return this.listen(cb);
          }, this)), 5000);
        }, this));
        response.on("data", __bind(function(json) {
          try {
            return cb(JSON.parse(json));
          } catch (_e) {}
        }, this));
        return response.on("end", __bind(function() {
          console.log("disconnected from twitter.");
          return setTimeout((__bind(function() {
            return this.listen(cb);
          }, this)), 5000);
        }, this));
      }, this));
      return request.end();
    };
    return Twitter;
  })();
  exports.Entry = Entry = (function() {
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
            var ratio, thumbHeight, thumbWidth;
            props.day = +props.day;
            thumbWidth = props.thumbWidth, thumbHeight = props.thumbHeight;
            ratio = thumbWidth / thumbHeight;
            if (ratio < 1) {
              thumbWidth = 133;
              thumbHeight = 133 / ratio;
            } else if (ratio > 1) {
              thumbHeight = 133;
              thumbWidth = 133 / ratio;
            } else {
              thumbHeight = thumbWidth = 133;
            }
            props.thumbWidth = thumbWidth;
            props.thumbHeight = thumbHeight;
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
      if (this.day < 0) {
        this.invalid = "beforeRamendan";
      } else if (this.day > 30) {
        this.invalid = "afterRamendan";
      } else if (err) {
        this.invalid = "beforeSunset";
      }
      op = db.multi();
      if (this.invalid === "beforeRamendan") {
        op.hset(this.user, "practice", this.uri);
      }
      if (!this.invalid) {
        op.hset("" + this.user + "/entries", this.day, this.uri);
      }
      op.hmset(this.user, {
        latest: this.uri,
        country: this.country
      });
      delete this.lat;
      delete this.lng;
      op.lpush("/entries/latest", this.uri);
      op.ltrim("/entries/latest", 0, 19);
      op.hmset(this.uri, this);
      return op.exec(__bind(function(err) {
        (new User({
          uri: this.user
        })).updateScore(function() {});
        return cb(err, this);
      }, this));
    };
    return Entry;
  })();
}).call(this);
