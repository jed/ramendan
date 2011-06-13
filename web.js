port = process.env.PORT || 3000

require('http').createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('ramendan coming soon...\n')
}).listen(port, function() {
  console.log("Listening on " + port);
})
