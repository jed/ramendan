(function() {
  var Tweet, User, handle, user, _ref;
  _ref = require("./models"), User = _ref.User, Tweet = _ref.Tweet;
  handle = process.argv[2];
  user = new User({
    handle: handle
  });
  user.fetch(function(data) {
    var tweet;
    tweet = new Tweet({
      source: data
    });
    return tweet.onFollow(function() {
      return process.exit(1);
    });
  });
}).call(this);
