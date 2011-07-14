(function() {
  var PORT, app, express;
  PORT = process.env.PORT;
  express = require("express");
  app = express.createServer();
  app.set("view engine", "hbs");
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
    var lang, _ref, _ref2;
    lang = ((_ref = req.headers["accept-language"]) != null ? (_ref2 = _ref.toLowerCase().match(/en|ja/g)) != null ? _ref2[0] : void 0 : void 0) || "en";
    return res.render("index-" + 'en', {
      name: "bar"
    });
  });
  app.listen(PORT, function() {
    return console.log("now listening on port " + PORT);
  });
}).call(this);
