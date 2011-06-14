(function() {
  var OAuth, PORT, REDISTOGO_URL, TWITTER_KEY, TWITTER_SECRET, TWITTER_TOKEN, TWITTER_TOKEN_SECRET, connectStream, db, env, file, handleEvent, http, oa, redis, redisUrl, server, static, url;
  http = require("http");
  url = require("url");
  static = require("node-static");
  redis = require("redis");
  OAuth = require("oauth").OAuth;
  env = process.env.SERVER === "PRODUCTION" ? process.env : require("./env");
  TWITTER_TOKEN = env.TWITTER_TOKEN, TWITTER_TOKEN_SECRET = env.TWITTER_TOKEN_SECRET, TWITTER_KEY = env.TWITTER_KEY, TWITTER_SECRET = env.TWITTER_SECRET, REDISTOGO_URL = env.REDISTOGO_URL, PORT = env.PORT;
  redisUrl = url.parse(REDISTOGO_URL);
  file = new static.Server("./public");
  oa = new OAuth("https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token", TWITTER_KEY, TWITTER_SECRET, "1.0A", "http://localhost:3000/oauth/callback", "HMAC-SHA1");
  db = redis.createClient(redisUrl.port, redisUrl.hostname);
  db.auth((redisUrl.auth.split(":"))[1], function() {
    return db.set("somekey", "somevalue", function() {
      return db.get("somekey", function(err, data) {
        return console.log("somekey is " + data);
      });
    });
  });
  handleEvent = function(data) {
    return console.log(data);
  };
  (connectStream = function() {
    var request;
    console.log("connecting to @ramendan stream...");
    request = oa.get("https://userstream.twitter.com/2/user.json", TWITTER_TOKEN, TWITTER_TOKEN_SECRET);
    request.addListener("response", function(res) {
      res.setEncoding("utf8");
      res.addListener("data", function(chunk) {
        var data;
        try {
          data = JSON.parse(chunk);
        } catch (_e) {}
        return handleEvent(data || {});
      });
      return res.addListener("end", function(data) {
        return console.log("connection terminated.", data);
      });
    });
    return request.end();
  })();
  server = http.createServer(function(req, res) {
    req.url === "favicon.ico" || (req.url = "/");
    return req.addListener("end", function() {
      return file.serve(req, res);
    });
  });
  server.listen(PORT, function() {
    return console.log("ramendan running on port " + PORT);
  });
}).call(this);
