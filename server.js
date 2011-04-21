http = require( "http" )
fs = require( "fs" )

var sites = {
  github:  "//github.com/jed",
  twitter: "//twitter.com/jedschmidt",
  flickr:  "//flickr.com/photos/tr4nslator"
}

var index

server = http.createServer( function( req, res ) {
  var url = req.url

  index = fs.readFileSync( "./index.html" )

  if ( ~url.indexOf( "/on/" ) ) {
    url = sites[ url.substr( 4 ) ] || "//jed.is/"

    res.writeHead( 302, { "Location": url } )
    return res.end()
  }
  
  res.writeHead( 200, { "Content-Type": "text/html" } )
  res.end( index )
})
 
server.listen( process.env.PORT || 8001 )

// https://gist.github.com/api/v1/json/gists/jed
// http://github.com/api/v2/json/user/show/jed
// http://gravatar.com/avatar/7b72d5a18ab92129692e97a76a153fe0?s=48
