var http = require( "http" )
  , fs = require( "fs" )
  
  , credentials = require( "./credentials" )
  , index = fs.readFileSync( "./index.html", "utf-8" )
  , lastTweet = fs.readFileSync( "./lastTweet.html", "utf-8" )

  , TwitterNode = require( "twitter-node" ).TwitterNode
  , twit = new TwitterNode( credentials )

  , html = index.replace( "{{lastTweet}}", lastTweet )

  , sites = {
      github:  "//github.com/jed",
      twitter: "//twitter.com/jedschmidt",
      flickr:  "//flickr.com/photos/tr4nslator"
    }
    
function htmlify( tweet ) {
  return tweet.replace(
    /[@]+([A-Za-z0-9-_]+)|[#]+([A-Za-z0-9-_]+)|(\b(?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig,
    function( match, user, tag, url ) {
      return 0,
        user ? "@" + user.link( "http://twitter.com/" + user ) :
        tag ? "#" + tag.link( "http://search.twitter.com/search?q=%23" + tag ) :
        url ? url.split( "//" )[ 1 ].link( url ) : ""
    })
}
    
twit
  .follow( 815114 )
  .addListener( "tweet", function( tweet ) {
    if ( tweet.in_reply_to_user_id ) return
    if ( tweet.user.id != 815114 ) return
    
    lastTweet = htmlify( tweet.text )
    html = index.replace( "{{lastTweet}}", lastTweet )

    fs.writeFileSync( "./lastTweet.html", lastTweet )    
  })
  .stream()

server = http.createServer( function( req, res ) {
  var url = req.url

  if ( ~url.indexOf( "/on/" ) ) {
    url = sites[ url.substr( 4 ) ] || "//jed.is/"

    res.writeHead( 302, { "Location": url } )
    return res.end()
  }
  
  res.writeHead( 200, {
    "Content-Type": "text/html",
    "Content-Length": Buffer.byteLength( html )
  })
  res.end( html )
})
 
server.listen( process.env.PORT || 8001 )