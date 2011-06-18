ramendan
========

pages
-----

### ramendan.com/

- introduction text
- explanation of rules
- "follow" button
- list of followers
- leaderboard

### ramendan.com/__user-name__

- only available for users following @ramendan
- calendar of 31 days
  - days in future low-opacity grayscale stock image of ramen
  - days participated with tweeted image and tweet text
  - days missed with gray image, big x
  - each day retweetable
- score summary
- recent @mentions and #hashtags

rules
-----

- follow @ramendan to play
- each entry must be a tweet:
  - with a valid geotag
  - with an image of noodles
  - mentioning @ramendan
  - between sunset and sunrise in the geotagged timezone
  
- if a user has multiple tweets on the same day, only the last is used

- must be a chinese-influenced, japanese noodle soup
- type of noodle must be included in one of the following:
  - http://en.wikipedia.org/wiki/Ramen
  - http://en.wikipedia.org/wiki/Ramen#Related_dishes

scoring
-------

- 1 point for each valid entry, up to 30

- 2 point for following (worship)
- 2 point for practice (duty)
- 2 point for #rAmen (reverence)
- 2 point for @mention (invocation)
- 2 point for RT (evangelism)
- 2 point for never missing a day (discipline)

- devotion ranking from infidel (0) to prophet (42)

implementation
--------------

- use 140byt.es template, jsonp, and router if possible
- write duplicate templates in japanese and english
- server in coffeescript on node.js, redis for db