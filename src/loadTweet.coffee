Tweet = require "./Tweet"
arg = process.argv[2]
id = (arg.match /\d+/ or []).pop()

if id
  tweet = new Tweet id_str: id
  tweet.fetch -> tweet.process -> process.exit 1

else console.log "invalid id: #{id}"