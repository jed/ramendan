redis = require "redis"

db = redis.createClient 9171, "barreleye.redistogo.com"
db.auth "e69796aec943588eb00ba405a8f88f02"

console.log "connected"

module.exports = db
