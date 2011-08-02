(function() {
  var OAuth, Tweet, db, embedly;
  db = require("./db");
  OAuth = require("oauth").OAuth;
  embedly = require("./embedly");
  exports.Tweet = Tweet = (function() {
    function Tweet(attrs) {
      var key, value;
      for (key in attrs) {
        value = attrs[key];
        this[key] = value;
      }
    }
    Tweet.prototype.load = function(cb) {
      return this.oa.get("http://api.twitter.com/1/statuses/show.json?id=" + id + "&include_entities=1", this.token.key, this.token.secret, cb);
    };
    return Tweet;
  })();
}).call(this);
