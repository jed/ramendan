(function() {
  var Entry, PORT, User, contents, file, fs, http, lang, name, obj, server, static, templates, url, _, _i, _len, _ref, _ref2;
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
  for (lang in templates) {
    obj = templates[lang];
    _ref2 = ["index", "layout", "user"];
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      name = _ref2[_i];
      contents = fs.readFileSync("./templates/" + name + "." + lang + ".html", "utf8");
      try {
        obj[name] = _.template(contents);
      } catch (_e) {}
    }
  }
  server = http.createServer(function(req, res) {
    var handler, handlers, index, path, pattern, uri, _ref3, _ref4;
    uri = url.parse(req.url, true);
    path = uri.pathname;
    lang = ((_ref3 = req.headers["accept-language"]) != null ? (_ref4 = _ref3.toLowerCase().match(/en|ja/g)) != null ? _ref4[0] : void 0 : void 0) || "en";
    index = 0;
    handlers = [
      /^\/$/, function(req, cb) {
        return cb(null, templates[lang].index({}));
      }, /^\/users\/(\w+)$/, function(req, cb) {
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
    while (pattern = handlers[index++]) {
      handler = handlers[index++];
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
    if ("ramen" in uri.query) {
      index = "teaser." + lang;
    }
    return file.serve(req, res);
  });
  server.listen(PORT, function() {
    return console.log("ramendan running on port " + PORT);
  });
}).call(this);
