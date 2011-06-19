{Twitter} = require "./models"

twitter = new Twitter
  consumer:
    key: "tcrzlUrmOHd6idGBYC4KTA"
    secret: "JURa2YCNWAhgw47TubS6SoTWawGhSqYYEq94f2bdUc"
  token:
    key: "315955679-zp64SIsgXwlW28qDEDt69APrql7u0AJFJFthJXoS"
    secret: "4BYQzGuK3dd5tNbo8orWwiFS9f7dZOATvz8MrLnrQ"

twitter.listen (tweet) -> tweet.save()
