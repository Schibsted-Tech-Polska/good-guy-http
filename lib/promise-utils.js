var util = require('util');

module.exports = function (Promise) {
  function collapsePromises(fn, keyFn) {
    keyFn = keyFn || concatenateArguments;
    var existingPromises = {};

    return function() {
      var key = keyFn([].slice.apply(arguments));
      if (existingPromises[key])
        return existingPromises[key];

      var promise = existingPromises[key] = fn.apply(null, arguments).then(function(result) {
        delete existingPromises[key];
        return result;
      }).catch(function(err) {
        delete existingPromises[key];
        throw err;
      });
      return promise;
    };
  }


  function retryPromise(fn, retries) {
    return function() {
      var args = [].slice.apply(arguments);

      return new Promise(function(resolve, reject) {
        tryOnce(retries);

        function tryOnce(triesRemaining) {
          fn.apply(null, args).then(function(result) {
            resolve(result);
          }).catch(function(err) {
            if (triesRemaining > 0 && (!err.unretriable))
              tryOnce(triesRemaining - 1);
            else
              reject(err);
          });
        }
      });
    };
  }

  function timeoutPromise(fn, timeout) {
    return function() {
      var args = [].slice.apply(arguments);
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          reject(new TimeoutError("Timeout expired."));
        }, timeout);

        fn.apply(null, args).then(resolve).catch(reject);
      });
    };
  }

  return {
    collapsePromises: collapsePromises,
    retryPromise: retryPromise,
    timeoutPromise: timeoutPromise
  };
};

function concatenateArguments(args) {
  return args.map(JSON.stringify).join("|");
}

function TimeoutError(message) {
  Error.call(this);
  this.code = "ETIMEDOUT";
  this.message = message;
}
util.inherits(TimeoutError, Error);
