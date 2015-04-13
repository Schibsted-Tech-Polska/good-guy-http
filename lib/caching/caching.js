var requestKey = require('./request-key');

module.exports = caching;

function caching(cache, config) {

  function checkForCachedResponse(request) {
    var key = requestKey(request);
    return cache.retrieve(key).then(function(cached) {
      // nothing in the cache
      if (!cached)
        return undefined;

      // expired?

    }).catch(function(err) {
      return undefined;
    });
  }
}
