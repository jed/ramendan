(function() {
  var Entry, PORT, User, app, express, getLang, _ref;
  PORT = process.env.PORT;
  express = require("express");
  app = express.createServer();
  _ref = require("./models"), User = _ref.User, Entry = _ref.Entry;
  app.set("view engine", "mustache");
  app.register(".mustache", require("stache"));
  app.configure(function() {
    app.use(express.static("" + __dirname + "/../public"));
    app.use(express.errorHandler({
      dumpExceptions: true,
      showStack: true
    }));
    app.use(express.cookieParser());
    app.use(express.session({
      secret: "n0o0o0o0odles!"
    }));
    return app.use(app.router);
  });
  app.get("/", function(req, res) {
    return res.render("index-" + (getLang(req)), {
      name: "bar"
    });
  });
  app.get("/users/:id", function(req, res) {
    return User.fromHandle(req.params.id, function(err, user) {
      if (!user) {
        return res.render("user404-" + (getLang(req)), {
          name: req.params.id
        });
      } else {
        return user.readWithEntries(function(err, user) {
          user.src = JSON.stringify(user);
          return res.render("user-" + (getLang(req)), user);
        });
      }
    });
  });
  app.listen(PORT, function() {
    return console.log("now listening on port " + PORT);
  });
  getLang = function(req) {
    var _ref2, _ref3;
    return ((_ref2 = req.headers["accept-language"]) != null ? (_ref3 = _ref2.toLowerCase().match(/en|ja/g)) != null ? _ref3[0] : void 0 : void 0) || "en";
  };
}).call(this);
