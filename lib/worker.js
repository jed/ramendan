(function() {
  var Tweet, twitter;
  Tweet = require("./models").Tweet;
  twitter = require("./twitter");
  twitter.stream("user", function(stream) {
    return stream.on("data", function(data) {
      return (new Tweet(data)).save();
    });
  });
}).call(this);
