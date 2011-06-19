(function() {
  var Entry, PORT, User, file, handlers, http, server, static, url, _ref;
  http = require("http");
  url = require("url");
  static = require("node-static");
  file = new static.Server("./public");
  PORT = process.env.PORT || 5000;
  _ref = require("./models"), User = _ref.User, Entry = _ref.Entry;
  handlers = [
    /^\/api$/, function(req, cb) {
      return Entry.latest(function(err, entries) {
        return User.latest(function(err, users) {
          return cb(null, {
            entries: entries,
            users: users
          });
        });
      });
    }, /^\/api\/users\/latest$/, function(req, cb) {
      return User.latest(cb);
    }, /^\/api\/users\/(\w+)$/, function(req, cb) {
      return db.hget("/handles", req.captures[1], function(err, uri) {
        if (!uri) {
          return cb(404);
        }
        return (new User({
          uri: uri
        })).readWithEntries(cb);
      });
    }, /^\/api\/entries\/latest$/, function(req, cb) {
      return Entry.latest(cb);
    }
  ];
  server = http.createServer(function(req, res) {
    var handler, index, lang, path, pattern, uri, _ref2, _ref3;
    uri = url.parse(req.url, true);
    path = uri.pathname;
    lang = ((_ref2 = req.headers["accept-language"]) != null ? (_ref3 = _ref2.toLowerCase().match(/en|ja/g)) != null ? _ref3[0] : void 0 : void 0) || "en";
    index = 0;
    while (pattern = handlers[index++]) {
      handler = handlers[index++];
      if (req.captures = path.match(pattern)) {
        return handler(req, function(err, data) {
          var body, callback, _ref4, _ref5;
          body = {
            data: data,
            lang: lang
          };
          callback = (_ref4 = uri.query.callback) != null ? (_ref5 = _ref4.match(/^\w+$/)) != null ? _ref5[0] : void 0 : void 0;
          body = "" + (callback || 'alert') + "(" + (JSON.stringify(body)) + ")";
          res.writeHead(200, {
            "Content-Length": Buffer.byteLength(body),
            "Content-Type": "text/javascript"
          });
          return res.end(body);
        });
      }
    }
    index = "ramen" in uri.query ? "index" : "teaser." + lang;
    if (!~path.indexOf(".")) {
      req.url = "/" + index + ".html";
    }
    return file.serve(req, res);
  });
  server.listen(PORT, function() {
    return console.log("ramendan running on port " + PORT);
  });
}).call(this);
