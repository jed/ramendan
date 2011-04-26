var http = require( "http" )
  , fs = require( "fs" )
  , static = require( "node-static" )
  
  , credentials = require( "./credentials" )
  , template = fs.readFileSync( "./template.html", "utf-8" )
  , lastTweet = fs.readFileSync( "./lastTweet.html", "utf-8" )
  , html = template.replace( "{{lastTweet}}", lastTweet )

  , TwitterNode = require( "twitter-node" ).TwitterNode
  , twit = new TwitterNode( credentials )

  , sites = {
      on: {
        "github":  "//github.com/jed",
        "twitter": "//twitter.com/jedschmidt",
        "flickr":  "//flickr.com/photos/tr4nslator"
      },
      
      knownfor: {
        "fab.js":    "//fabjs.org",
        "typd.in":   "//typd.in",
        "textpanda": "//textpanda.com"
      }
    }
    
  , server = http.createServer()
  , file = new static.Server( "./public" )

fs.writeFileSync( "./public/index.html", html )
    
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
  .addListener( "error", function( error ) {
    console.log( error.message )
  })
  .addListener( "tweet", function( tweet ) {
    if ( tweet.in_reply_to_user_id ) return
    if ( tweet.user.id != 815114 ) return
    
    lastTweet = htmlify( tweet.text )
    html = template.replace( "{{lastTweet}}", lastTweet )

    fs.writeFileSync( "./public/index.html", html )
    fs.writeFileSync( "./lastTweet.html", lastTweet )
  })
  .stream()
  
server
  .on( "request", function( req, res ) {
    var url = req.url
  
    if ( ~url.indexOf( "/on/" ) ) {
      url = sites.on[ url.substr( 4 ) ] || "//jed.is/"
  
      res.writeHead( 302, { "Location": url } )
      return res.end()
    }

    else if ( ~url.indexOf( "/knownfor/" ) ) {
      url = sites.knownfor[ url.substr( 10 ) ] || "//jed.is/"
  
      res.writeHead( 302, { "Location": url } )
      return res.end()
    }

    req.addListener( "end", function() {
      file.serve( req, res )
    })
  })
  .listen( process.env.PORT || 8001 )