(function() {
  var Entry, User, db;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  db = require("./db");
  Entry = require("./Entry");
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
  module.exports = User;
}).call(this);
