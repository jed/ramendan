(function() {
  var OAuth, TWITTER_KEY, TWITTER_SECRET, TWITTER_TOKEN, TWITTER_TOKEN_SECRET, connectStream, handleEvent, oa, resources, _ref;
  OAuth = require("oauth").OAuth;
  _ref = process.env, TWITTER_TOKEN = _ref.TWITTER_TOKEN, TWITTER_TOKEN_SECRET = _ref.TWITTER_TOKEN_SECRET, TWITTER_KEY = _ref.TWITTER_KEY, TWITTER_SECRET = _ref.TWITTER_SECRET;
  resources = {
    followers: "http://api.twitter.com/1/followers/ids.json"
  };
  oa = new OAuth("https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token", TWITTER_KEY, TWITTER_SECRET, "1.0A", "http://localhost:3000/oauth/callback", "HMAC-SHA1");
  handleEvent = function(data) {
    return console.log(data);
  };
  connectStream = function() {
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
      return res.addListener("end", function() {
        console.log("connection terminated.");
        return connectStream();
      });
    });
    return request.end();
  };
}).call(this);
