var waitFor = require('./helpers').waitFor;
var lruCache = require('../../lib/caching/lru-cache');

module.exports = function(delayMs) {
  var originalCache = lruCache(50);
  var retrievesCalled = 0;
  var storesCalled = 0;

  return {
    store: function(key, object) {
      storesCalled++;
      return waitFor(delayMs).then(function() {
        return originalCache.store(key, object);
      });
    },

    retrieve: function(key) {
      retrievesCalled++;
      return waitFor(delayMs).then(function() {
        return originalCache.retrieve(key);
      });
    },

    retrievesCalled: function() { return retrievesCalled; },
    storesCalled:    function() { return storesCalled; }
  };
};
