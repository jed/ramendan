(function() {
  var OAuth, accessToken, accessTokenSecret, connectStream, handleEvent, oa, resources;
  OAuth = require("oauth").OAuth;
  accessToken = "315955679-o0jcyL1G1p7KgtSD6IUvksGyPvlWQwyWexDfNwMG";
  accessTokenSecret = "G9F1pJYqoEgfHe55S7OX8NoiIcOZmAfVJsWYgyA7Y";
  resources = {
    followers: "http://api.twitter.com/1/followers/ids.json"
  };
  oa = new OAuth("https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token", "tcrzlUrmOHd6idGBYC4KTA", "JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc", "1.0A", "http://localhost:3000/oauth/callback", "HMAC-SHA1");
  handleEvent = function(data) {
    return console.log(data);
  };
  connectStream = function() {
    var request;
    console.log("connecting to @ramendan stream...");
    request = oa.get("https://userstream.twitter.com/2/user.json", accessToken, accessTokenSecret);
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
