(function() {
  var Follower, OAuth, PORT, REDISTOGO_URL, TWITTER_KEY, TWITTER_SECRET, TWITTER_TOKEN, TWITTER_TOKEN_SECRET, connectStream, db, env, file, handleEvent, handlers, http, oa, redis, redisUrl, server, static, url;
  var __hasProp = Object.prototype.hasOwnProperty, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  http = require("http");
  url = require("url");
  static = require("node-static");
  redis = require("redis");
  OAuth = require("oauth").OAuth;
  env = (function() {
    try {
      return require("./env");
    } catch (e) {
      return process.env;
    }
  })();
  TWITTER_TOKEN = env.TWITTER_TOKEN, TWITTER_TOKEN_SECRET = env.TWITTER_TOKEN_SECRET, TWITTER_KEY = env.TWITTER_KEY, TWITTER_SECRET = env.TWITTER_SECRET, REDISTOGO_URL = env.REDISTOGO_URL, PORT = env.PORT;
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
        if (err || !exists) {
          return cb(404);
        } else {
          return db.hgetall(uri, function(err, props) {
            if (err) {
              return cb(err);
            } else {
              return cb(null, new Follower(props));
            }
          });
        }
      });
    };
    Follower.prototype.save = function(cb) {
      var key, op, properties, value;
      properties = {};
      for (key in this) {
        if (!__hasProp.call(this, key)) continue;
        value = this[key];
        if (typeof value === "string") {
          properties[key] = value;
        }
      }
      op = db.multi();
      op.hmset("/followers/" + this.id, properties);
      op.hset("/handles", this.handle, this.id);
      op.zadd("/followers", +new Date(this.since), this.id);
      return op.exec(__bind(function(err) {
        return cb(err, this);
      }, this));
    };
    return Follower;
  })();
  handleEvent = function(data) {
    var follower;
    if (data == null) {
      return;
    }
    if (data.event === "follow") {
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
        var request;
        if (err) {
          return;
        }
        console.log("new follower: " + follower.handle);
        return request = oa.post("http://api.twitter.com/1/statuses/update.json", TWITTER_TOKEN, TWITTER_TOKEN_SECRET, {
          status: "@" + follower.handle + " Your #ramendan calendar is ready! http://ramendan.com/" + follower.handle
        }, function(err, data) {
          return console.log(err || ("confirmation sent to " + follower.handle + "."));
        });
      });
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
        return handleEvent((function() {
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
