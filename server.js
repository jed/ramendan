http = require( "http" )
fs = require( "fs" )

index = fs.readFileSync( "./index.html" )

server = http.createServer( function( req, res ) {
  if ( req.url == "/" ) {
    res.writeHead( 302, { "Location": "/coming.soon..." } )
    res.end()
  }
  
  else {
    res.writeHead( 200, { "Content-Type": "text/html" } )
    res.end( index )
  }
})
 
server.listen( process.env.PORT || 8001 )

// https://gist.github.com/api/v1/json/gists/jed
// http://github.com/api/v2/json/user/show/jed
// 
// jed.is/on/github
// jed.is/on/twitter
// jed.is/on/flickr
