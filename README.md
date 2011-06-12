ramendan
========

hallelujah, it's raining 麺: a jed/mitcho collaboration.

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

- 1 point for each valid entry
- devotion ranking from infidel (0) to prophet (31)
- mention @ramendan for disciple badge

implementation
--------------

- use 140byt.es template, jsonp, and router if possible
- write duplicate templates in japanese and english
- server in coffeescript on node.js, redis for db
- run on heroku (?)