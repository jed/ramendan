http = require( "http" )
 
server = http.createServer( function( req, res ) {
  res.writeHead( 200, { "Content-Type": "text/plain" } )
  res.end( "Coming soon..." )
})
 
server.listen( process.env.PORT || 8001 )