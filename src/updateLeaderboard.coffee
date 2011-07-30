db = require "./db"
{User} = require "./models"

db.zrevrange "/users", 0, -1, (err, list) ->
  for uri in list
    (new User uri: uri).updateScore ->