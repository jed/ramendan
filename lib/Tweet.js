(function() {
  var Entry, OAuth, Tweet, User, credentials, oa;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  OAuth = require("oauth").OAuth;
  User = require("./User");
  Entry = require("./Entry");
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
  Tweet = Tweet = (function() {
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
  module.exports = Tweet;
}).call(this);
