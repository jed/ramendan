(function() {
  var Tweet, arg, id, tweet;
  Tweet = require("./Tweet");
  arg = process.argv[2];
  id = (arg.match(/\d+/ || [])).pop();
  if (id) {
    tweet = new Tweet({
      id_str: id
    });
    tweet.fetch(function() {
      return tweet.process(function() {
        return process.exit(1);
      });
    });
  } else {
    console.log("invalid id: " + id);
  }
}).call(this);
