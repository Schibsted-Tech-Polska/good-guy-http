var assert = require('assert');
var _ = require('underscore');

var circuitBreaking = require('../../lib/circuit-breaking');
var expectRejection = require('../helpers').expectRejection;

describe("Functions wrapped with a circuit breaker", function() {
  it("should pass arguments and successes along", function(done) {
    var fn = circuitBreaking(function(a) {
      return a * 2;
    });
    fn(2).then(function(result) {
      assert.equal(result, 4);
    }).then(done).catch(done);
  });

  it("should pass failures along", function(done) {
    var fn = circuitBreaking(function() {
      throw new Error("Ouch!");
    });
    expectRejection(fn()).then(function(err) {
      assert.equal(err.message, "Ouch!");
    }).then(done).catch(done);
  });

  it("should start returning CircuitBrokenError after enough failures", function(done) {
    var fn = circuitBreaking(failForOddNumbers);

    // call enough times to open the circuit
    var setupCalls = _.range(30).map(function(arg) { return fn(arg).catch(function() {}); });
    Promise.all(setupCalls).then(function() {
      return expectRejection(fn(32)).then(function(err) {
        assert.equal(err.code, 'ECIRCUIT');
      });
    }).then(done).catch(done);
  });

  it("should allow for multiple circuit breakers using a key function", function(done) {
    var keyFn = function(args) { return args[0] % 2; }; // odd and even numbers get separate breakers
    var fn = circuitBreaking(failForOddNumbers, keyFn);

    var setupCalls = _.range(50).map(function(arg) { return fn(arg).catch(function() {}); });
    Promise.all(setupCalls).then(function() {
      // odd numbers should have their circuit open
      return expectRejection(fn(33));
    }).then(function(err) {
      assert.equal(err.code, 'ECIRCUIT');
      // even numbers should still work, since they didn't have failures
      return fn(34);
    }).then(function(result) {
      assert.equal(result, "Ok!");
    }).then(done).catch(done);
  });
});

function failForOddNumbers(arg) {
  if (arg % 2) {
    throw new Error("Every odd number fails.");
  } else {
    return "Ok!";
  }
}
