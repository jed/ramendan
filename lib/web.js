(function() {
  var Entry, PORT, User, compileTemplates, file, fs, http, server, static, templates, url, _, _ref;
  http = require("http");
  url = require("url");
  fs = require("fs");
  _ = require("underscore");
  static = require("node-static");
  PORT = process.env.PORT;
  _ref = require("./models"), User = _ref.User, Entry = _ref.Entry;
  file = new static.Server("./public");
  templates = {
    en: {},
    ja: {}
  };
  (compileTemplates = function() {
    var contents, lang, name, obj, _results;
    console.log("recompiling templates...");
    _results = [];
    for (lang in templates) {
      obj = templates[lang];
      _results.push((function() {
        var _i, _len, _ref2, _results2;
        _ref2 = ["index", "layout", "user"];
        _results2 = [];
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          name = _ref2[_i];
          contents = fs.readFileSync("./templates/" + name + "." + lang + ".html", "utf8");
          _results2.push(obj[name] = (function() {
            try {
              return _.template(contents);
            } catch (e) {
              return e.message;
            }
          })());
        }
        return _results2;
      })());
    }
    return _results;
  })();
  server = http.createServer(function(req, res) {
    var handler, handlers, i, isDev, lang, path, pattern, uri, _ref2, _ref3;
    uri = url.parse(req.url, true);
    path = uri.pathname;
    lang = ((_ref2 = req.headers["accept-language"]) != null ? (_ref3 = _ref2.toLowerCase().match(/en|ja/g)) != null ? _ref3[0] : void 0 : void 0) || "en";
    i = 0;
    isDev = !req.headers.host.indexOf("localhost");
    if (isDev) {
      compileTemplates();
    }
    handlers = [
      /^\/$/, function(req, cb) {
        return cb(null, templates[lang].index({}));
      }, /^\/(\w+)$/, function(req, cb) {
        return User.fromHandle(req.captures[1], function(err, user) {
          if (err) {
            return cb(err);
          } else {
            return user.readWithEntries(function(err, user) {
              return cb(null, templates[lang].user(user));
            });
          }
        });
      }
    ];
    if (path === "/" && !isDev) {
      req.url = "/teaser." + lang + ".html";
      return file.serve(req, res);
    }
    while (pattern = handlers[i++]) {
      handler = handlers[i++];
      if (req.captures = path.match(pattern)) {
        return handler(req, function(err, html) {
          if (err) {
            html = "404";
          }
          html = templates[lang].layout({
            body: html
          });
          res.writeHead(200, {
            "Content-Length": Buffer.byteLength(html),
            "Content-Type": "text/html"
          });
          return res.end(html);
        });
      }
    }
    return file.serve(req, res);
  });
  server.listen(PORT, function() {
    return console.log("ramendan running on port " + PORT);
  });
}).call(this);
