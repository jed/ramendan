var http = require( "http" )
  , fs = require( "fs" )
  , TwitterNode = require( "twitter-node" ).TwitterNode
  , index = fs.readFileSync( "./index.html", "utf-8" )
  , html = index.replace( "{{currently}}", "waiting for the next tweet to load." )
  , sites = {
      github:  "//github.com/jed",
      twitter: "//twitter.com/jedschmidt",
      flickr:  "//flickr.com/photos/tr4nslator"
    }

new TwitterNode({
    user: "jedschmidt",
    password: "yaM@47hz(#z",
    follow: [ 815114 ]
  })
  .addListener( "tweet", function( tweet ) {
    if ( tweet.in_reply_to_user_id ) return
    if ( tweet.user.id != 815114 ) return
    
    html = index.replace( "{{currently}}", tweet.text )
  })
  .stream()

server = http.createServer( function( req, res ) {
  var url = req.url

  if ( ~url.indexOf( "/on/" ) ) {
    url = sites[ url.substr( 4 ) ] || "//jed.is/"

    res.writeHead( 302, { "Location": url } )
    return res.end()
  }
  
  res.writeHead( 200, { "Content-Type": "text/html" } )
  res.end( html )
})
 
server.listen( process.env.PORT || 8001 )

// https://gist.github.com/api/v1/json/gists/jed
// http://github.com/api/v2/json/user/show/jed
// http://gravatar.com/avatar/7b72d5a18ab92129692e97a76a153fe0?s=48

