(function() {
  var Api, Entry, OAuth, Tweet, User, credentials, db, embedly, http, oa;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  db = require("./db");
  http = require("http");
  OAuth = require("oauth").OAuth;
  Api = require("embedly").Api;
  embedly = new Api({
    key: 'daf28dd296b811e0bc3c4040d3dc5c07'
  });
  credentials = {
    consumer: {
      key: "tcrzlUrmOHd6idGBYC4KTA",
      secret: "JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc"
    },
    token: {
      key: "315955679-zp64SIsgXwlW28qDEDt69APrql7u0AJFJFthJXoS",
      secret: "4BYQzGuK3dd5tNbo8orWwiFS9f7dZOATvz8MrLnrQ"
    }
  };
  oa = new OAuth("https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token", credentials.consumer.key, credentials.consumer.secret, "1.0A", null, "HMAC-SHA1");
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
    Entry.prototype.process = function(cb) {
      return this.getPhoto(__bind(function(err) {
        if (err || this.invalid) {
          return cb(err);
        } else {
          return this.getGeo(cb);
        }
      }, this));
    };
    Entry.prototype.getPhoto = function(cb) {
      var req;
      req = embedly.oembed({
        url: this.url
      });
      req.on("complete", __bind(function(_arg) {
        var obj;
        obj = _arg[0];
        if ((obj != null ? obj.type : void 0) === "photo") {
          this.img = obj.url;
          this.height = obj.height;
          this.width = obj.width;
          this.thumb = obj.thumbnail_url;
          this.thumbWidth = obj.thumbnail_width;
          this.thumbHeight = obj.thumbnail_height;
        } else {
          this.invalid = "type is " + (obj != null ? obj.type : void 0) + ", not photo";
        }
        return cb(null);
      }, this));
      return req.start();
    };
    Entry.prototype.getGeo = function(cb) {
      return http.get({
        host: "api.geonames.org",
        path: "/timezoneJSON?username=jed&lat=" + this.lat + "&lng=" + this.lng
      }, __bind(function(res) {
        var data;
        data = "";
        res.setEncoding("utf8");
        res.on("data", function(chunk) {
          return data += chunk;
        });
        return res.on("end", __bind(function() {
          var dawn, dstOffset, dusk, local, sunrise, sunset, time;
          try {
            data = JSON.parse(data);
            dstOffset = data.dstOffset, sunrise = data.sunrise, sunset = data.sunset, this.countryName = data.countryName;
            local = new Date(+this.time + dstOffset * 36e5);
            this.day = (0 | local / 86400000) - 15186;
            sunrise = sunrise.slice(-5);
            sunset = sunset.slice(-5);
            time = local.toUTCString().slice(-12, -7);
            dawn = time <= sunrise;
            dusk = time >= sunset;
            if (dawn) {
              this.day--;
            }
            if (!(dusk || dawn)) {
              this.invalid = "" + time + " is before " + sunset;
            }
            return cb(null);
          } catch (e) {
            return cb(e);
          }
        }, this));
      }, this));
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
      } else if (this.day > 29) {
        this.invalid = "afterRamendan";
      }
      op = db.multi();
      if (this.invalid) {
        console.log("" + this.uri + " is invalid: " + this.invalid);
      } else {
        op.hset("" + this.user + "/entries", this.day, this.uri);
      }
      op.hmset(this.user, {
        latest: this.uri,
        country: this.countryName
      });
      delete this.lat;
      delete this.lng;
      op.lpush("/entries/latest", this.uri);
      op.ltrim("/entries/latest", 0, 19);
      op.hmset(this.uri, this);
      return op.exec(__bind(function(err) {
        return (new User({
          uri: this.user
        })).updateScore(__bind(function(err) {
          return cb(err, this);
        }, this));
      }, this));
    };
    return Entry;
  })();
  Tweet = (function() {
    Tweet.listen = function() {
      var request;
      request = oa.get("https://userstream.twitter.com/2/user.json?track=%23rAmen.", credentials.token.key, credentials.token.secret);
      request.on("response", __bind(function(response) {
        console.log("listening for tweets...");
        response.setEncoding("utf8");
        response.on("error", __bind(function(err) {
          console.log(err);
          return setTimeout((__bind(function() {
            return this.listen(cb);
          }, this)), 5000);
        }, this));
        response.on("data", __bind(function(json) {
          try {
            return (new Tweet(JSON.parse(json))).process();
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
    function Tweet(attrs) {
      var key, value;
      for (key in attrs) {
        value = attrs[key];
        this[key] = value;
      }
    }
    Tweet.prototype.parse = function(json, cb) {
      var data, key, value;
      try {
        data = JSON.parse(json);
        for (key in data) {
          value = data[key];
          this[key] = value;
        }
        return cb(null, this);
      } catch (err) {
        return cb(err);
      }
    };
    Tweet.prototype.send = function(cb) {
      return oa.post("http://api.twitter.com/1/statuses/update.json", credentials.token.key, credentials.token.secret, {
        status: this.text
      }, cb);
    };
    Tweet.prototype.fetch = function(cb) {
      return oa.get("http://api.twitter.com/1/statuses/show.json?id=" + this.id_str + "&include_entities=1", credentials.token.key, credentials.token.secret, __bind(function(err, data) {
        if (err) {
          return cb(err);
        } else {
          return this.parse(data, cb);
        }
      }, this));
    };
    Tweet.prototype.isFollow = function() {
      return this.event === "follow";
    };
    Tweet.prototype.isEntry = function() {
      var _ref;
      return this.geo && this.in_reply_to_screen_name === "ramendan" && ((_ref = this.entities) != null ? _ref.urls.length : void 0);
    };
    Tweet.prototype.isRetweet = function() {
      var _ref;
      return ((_ref = this.retweeted_status) != null ? _ref.user.screen_name : void 0) === "ramendan";
    };
    Tweet.prototype.isMention = function() {
      var _ref, _ref2;
      return !this.in_reply_to_screen_name && ((_ref = this.entities) != null ? (_ref2 = _ref.user_mentions) != null ? _ref2.some(function(x) {
        return x.screen_name === "ramendan";
      }) : void 0 : void 0);
    };
    Tweet.prototype.isHashtag = function() {
      return /#rAmen\.?$/i.test(this.text);
    };
    Tweet.prototype.onEntry = function(cb) {
      var entry, user, _ref, _ref2;
      user = new User({
        uri: "/users/" + this.user.id_str,
        handle: this.user.screen_name
      });
      entry = new Entry({
        user: user.uri,
        uri: "/status/" + this.id_str,
        url: (_ref = this.entities) != null ? _ref.urls[0].url : void 0,
        time: new Date(this.created_at),
        text: this.text.slice(10).replace(/^ http\S+/g, ""),
        invalid: false
      });
      _ref2 = this.geo.coordinates, entry.lat = _ref2[0], entry.lng = _ref2[1];
      return entry.process(function(err) {
        if (err) {
          console.log("entry is invalid: " + entry.invalid);
          return cb(null);
        } else {
          return entry.save(function() {
            console.log("entry is valid: " + entry.uri);
            return cb(null);
          });
        }
      });
    };
    Tweet.prototype.onFollow = function(cb) {
      var user;
      user = new User({
        uri: "/users/" + this.source.id_str,
        handle: this.source.screen_name.toLowerCase(),
        name: this.source.name,
        img: this.source.profile_image_url,
        lang: this.source.lang,
        since: new Date,
        score: 0,
        country: "Unknown"
      });
      return user.save(function(err, user) {
        var tweet;
        if (err) {
          return console.log(err);
        }
        console.log("new user: " + user.handle);
        tweet = new Tweet({
          text: "@" + user.handle + " Your #ramendan calendar is ready! http://ramendan.com/" + user.handle
        });
        return tweet.send(function(err, data) {
          console.log(err || ("confirmation sent to " + user.handle + "."));
          return cb(null);
        });
      });
    };
    Tweet.prototype.process = function(cb) {
      if (this.isFollow()) {
        return this.onFollow(cb);
      } else {
        return (new User({
          uri: "/users/" + this.user.id_str
        })).read(__bind(function(err, user) {
          if (err) {
            ;
          } else if (this.isEntry()) {
            console.log("new entry from " + user.handle);
            return this.onEntry(cb);
          } else if (this.isRetweet() && !user.retweet) {
            console.log("new retweet from " + user.handle);
            return user.attr("retweet", this.id_str, function() {
              return user.updateScore(cb);
            });
          } else if (this.isMention() && !user.mention) {
            console.log("new mention from " + user.handle);
            return user.attr("mention", this.id_str, function() {
              return user.updateScore(cb);
            });
          } else if (this.isHashtag() && !user.hashtag) {
            console.log("new hashtag from " + user.handle);
            return user.attr("hashtag", this.id_str, function() {
              return user.updateScore(cb);
            });
          } else {
            console.log("not sure how to handle " + this.id_str);
            return cb(null);
          }
        }, this));
      }
    };
    return Tweet;
  })();
  User = (function() {
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
    User.prototype.fetch = function(cb) {
      return oa.get("http://api.twitter.com/1/users/show.json?screen_name=" + this.handle, credentials.token.key, credentials.token.secret, __bind(function(err, data) {
        if (err) {
          return cb(err);
        } else {
          return cb(JSON.parse(data));
        }
      }, this));
    };
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
            today = (0 | new Date / 86400000) - 15186;
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
            i = 30;
            return (run = function() {
              if (!i--) {
                return cb(null, user);
              }
              return (new Entry({
                uri: props[i]
              })).read(function(err, entry) {
                if (entry) {
                  user.entries[entry.day] = entry;
                }
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
  exports.User = User;
  exports.Entry = Entry;
  exports.Tweet = Tweet;
}).call(this);
