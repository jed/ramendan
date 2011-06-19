(function() {
  var Tweet, twitter;
  Tweet = require("./models").Tweet;
  twitter = require("./twitter");
  console.log("connecting to twitter...");
  twitter.stream("user", function(stream) {
    console.log("connected to twitter: " + (JSON.stringify(stream)));
    stream.on("end", function() {
      return console.log("end");
    });
    stream.on("error", function(err) {
      return console.log(err);
    });
    return stream.on("data", function(data) {
      return console.log(data);
    });
  });
}).call(this);
