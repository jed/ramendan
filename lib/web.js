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
    return User.top(function(err, users) {
      return res.render("index-" + (getLang(req)), {
        users: users
      });
    });
  });
  app.get(/^\/(\w+)$/, function(req, res) {
    return res.redirect("/users/" + req.params[0]);
  });
  app.get("/users/:id", function(req, res) {
    return User.fromHandle(req.params.id, function(err, user) {
      if (!user) {
        return res.render("user404-" + (getLang(req)), {
          name: req.params.id
        });
      } else {
        return user.readWithEntries(function(err, user) {
          return res.render("user-" + (getLang(req)), user);
        });
      }
    });
  });
  app.listen(PORT, function() {
    return console.log("now listening on port " + PORT);
  });
  getLang = function(req) {
    return "en";
  };
}).call(this);
