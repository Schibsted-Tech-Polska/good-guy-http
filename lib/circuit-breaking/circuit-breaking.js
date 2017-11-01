var _ = require('underscore');
var util = require('util');
var CircuitBreaker = require('@schibstedpl/circuit-breaker-js');

var DEFAULT_CIRCUIT_BREAKER_OPTIONS = {
  windowDuration: 10000,
  numBuckets: 10,
  timeoutDuration: 60000, // in context of good-guy-http, timeouts are handled by us (as errors, so they will still trip the breaker)
  errorThreshold: 20,
  volumeThreshold: 20
};

var CircuitBrokenError = module.exports.CircuitBrokenError = function() {
  Error.call(this);
  this.message = "Circuit broken.";
  this.code = 'ECIRCUIT';
};
util.inherits(CircuitBrokenError, Error);

module.exports = function circuitBreaking(fn, keyFn, circuitBreakerOptions) {
  keyFn = keyFn || function() { return 'one-and-only'; };
  circuitBreakerOptions = _.defaults(circuitBreakerOptions || {}, DEFAULT_CIRCUIT_BREAKER_OPTIONS);

  var Promise = circuitBreakerOptions.promise || global.Promise;
  var circuitBreakers = {};

  return function() {
    var args = [].slice.apply(arguments);
    var breaker = breakerFor(args);

    return new Promise(function(resolve, reject) {
      breaker.run(function(succeed, fail) {
        var promise;
        try {
          promise = Promise.resolve(fn.apply(null, args));
        } catch(err) {
          fail();
          reject(err);
        }

        promise
          .then(function(value) {
            succeed();
            resolve(value);
          }).catch(function(err) {
            fail(err);
            reject(err);
          });
      }, function() {
        // fallback
        reject(new CircuitBrokenError());
      });
    });
  };

  function breakerFor(args) {
    var key = keyFn(args);
    if (!circuitBreakers[key]) {
      circuitBreakers[key] = new CircuitBreaker(circuitBreakerOptions);
    }
    return circuitBreakers[key];
  }
};
