(function() {
  var Api, Entry, User, db, embedly, http;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  http = require("http");
  db = require("./db");
  User = require("./User");
  Api = require("embedly").Api;
  embedly = new Api({
    key: 'daf28dd296b811e0bc3c4040d3dc5c07'
  });
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
          this.invalid = "notPhoto";
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
              this.invalid = "beforeSunset";
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
      if (!this.invalid) {
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
        })).updateScore(function() {
          return cb(err, this);
        });
      }, this));
    };
    return Entry;
  })();
  module.exports = Entry;
}).call(this);
