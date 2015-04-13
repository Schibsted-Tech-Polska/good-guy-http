var Promise = require('bluebird');


module.exports.collapsePromises = function(fn) {
  var existingPromises = {};
  var keyFn = concatenateArguments;

  return function() {
    var key = keyFn.apply(null, arguments);
    if (existingPromises[key])
      return existingPromises[key];

    var promise = existingPromises[key] = fn.apply(null, arguments).then(function(result) {
      return result;
    }).finally(function() {
      delete existingPromises[key];
    });
    return promise;
  };
};


module.exports.retryPromise = function(fn, retries) {
  return function() {
    var args = [].slice.apply(arguments);

    return new Promise(function(resolve, reject) {
      tryOnce(retries);

      function tryOnce(triesRemaining) {
        fn.apply(null, args).then(function(result) {
          resolve(result);
        }).catch(function(err) {
          if (triesRemaining > 0)
            tryOnce(triesRemaining - 1);
          else
            reject(err);
        });
      }
    });
  };
};

function concatenateArguments() {
  var array = [].slice.apply(arguments);
  return array.map(JSON.stringify).join("|");
}
