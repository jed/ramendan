(function() {
  var PORT, file, http, server, static;
  PORT = process.env.PORT || 3000;
  http = require("http");
  static = require("node-static");
  file = new static.Server("./public");
  server = http.createServer(function(req, res) {
    req.url === "favicon.ico" || (req.url = "/");
    return req.addListener("end", function() {
      return file.serve(req, res);
    });
  });
  server.listen(PORT, function() {
    return console.log("ramendan running on port " + PORT);
  });
}).call(this);
