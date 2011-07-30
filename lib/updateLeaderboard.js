(function() {
  var User, db;
  db = require("./db");
  User = require("./models").User;
  db.zrevrange("/users", 0, -1, function(err, list) {
    var uri, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = list.length; _i < _len; _i++) {
      uri = list[_i];
      _results.push((new User({
        uri: uri
      })).updateScore(function() {}));
    }
    return _results;
  });
}).call(this);
