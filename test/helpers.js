var Promise = require('bluebird');

/**
 * Inverts a promise: rejections turns into successes (with error as the value),
 * while successes turn into rejections.
 */
module.exports.expectRejection = function expectRejection(promise) {
  return new Promise(function(resolve, reject) {
    promise.then(function() {
      reject(new Error("The promise wasn't rejected."));
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

