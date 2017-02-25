/**
 * Inverts a promise: rejections turns into successes (with error as the value),
 * while successes turn into rejections.
 */
module.exports.expectRejection = function expectRejection(promise) {
  return new Promise(function(resolve, reject) {
    promise.then(function(value) {
      reject(new Error("The promise wasn't rejected, but resolved with value: " + value));
    }).catch(function(err) {
      resolve(err);
    });
  });
};

module.exports.mockTimer = function() {
  var time = 0;
  var timer = function() {
    return time;
  };
  timer.advance = function(ms) {
    time += ms;
  };
  return timer;
};

module.exports.waitFor = function(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
};

module.exports.delayCache = function(originalCache, delayMs) {
  var waitFor = module.exports.waitFor;
  return {
    store: function(key, object) {
      return waitFor(delayMs).then(function() {
        return originalCache.store(key, object);
      });
    },

    retrieve: function(key) {
      return waitFor(delayMs).then(function() {
        return originalCache.retrieve(key);
      });
    }
  };
};
