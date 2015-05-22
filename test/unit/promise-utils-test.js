var assert = require('assert');
var Promise = require('bluebird');
var waitFor = require('../helpers').waitFor;

var retryPromise = require('../../lib/promise-utils').retryPromise;
var collapsePromises = require('../../lib/promise-utils').collapsePromises;
var timeoutPromise = require('../../lib/promise-utils').timeoutPromise;

var expectRejection = require('./../helpers').expectRejection;

describe("Retrying promises", function() {

  it("should pass arguments and result on correctly", function(done) {
    var fn = retryPromise(function(a, b, c) {
      return Promise.resolve(a + b + c);
    }, 0);

    fn("a", "b", "c").then(function(result) {
      assert.equal(result, "abc");
      done();
    }).catch(done);
  });

  it("should retry the right number of times", function(done) {
    var testFn = failXTimesThenReturnArgument(3);
    var withRetries = retryPromise(testFn, 3);

    withRetries("Ok!").then(function(result) {
      assert.equal(result, "Ok!");
      done();
    }).catch(done);
  });

  it("should reject with the last error if retries are exhausted", function(done) {
    var testFn = failXTimesThenReturnArgument(3);
    var withRetries = retryPromise(testFn, 2);

    expectRejection(withRetries("Ok!")).then(function(err) {
      assert.equal(err, "Failing, 0 remaining!");
      done();
    }).catch(done);
  });
});

describe("Collapsing promises", function() {
  it("should pass arguments and result correctly", function(done) {
    var fn = collapsePromises(makeOneTimeDoublingFunction(10));
    fn(21).then(function(result) {
      assert.equal(result, 42);
      done();
    }).catch(done);
  });

  it("should pass errors correctly", function(done) {
    var fn = function() {
      return Promise.reject("Ouch!");
    };
    fn = collapsePromises(fn);
    expectRejection(fn()).then(function(error) {
      assert.equal(error, "Ouch!");
    }).then(done).catch(done);
  });

  it("should collapse multiple calls into one", function(done) {
    var fn = collapsePromises(makeOneTimeDoublingFunction(10));
    Promise.all([fn(1), fn(1), fn(1)]).then(function(results) {
      assert.deepEqual(results, [2, 2, 2]);
      done();
    }).catch(done);
  });

  it("should collapse only when parameters are the same", function(done) {
    var fn = collapsePromises(makeOneTimeDoublingFunction(10));
    Promise.all([fn(1), fn(1), fn(2)]).then(function(results) {
      assert.deepEqual(results, [2, 2, 'already-called']);
      done();
    }).catch(done);
  });

  it("should make a new promise once the previous finishes", function(done) {
    var fn = collapsePromises(makeOneTimeDoublingFunction(10));
    fn(1).then(function(result) {
      assert.equal(result, 2);
      fn(1).then(function(newResult) {
        assert.equal(newResult, 'already-called');
        done();
      });
    }).catch(done);
  });
});

describe("Timeout wrapper for promises", function() {
  it("should pass results correctly", function(done) {
    var fn = function() {
      return Promise.resolve("Ok!");
    };
    fn = timeoutPromise(fn, 50);

    fn().then(function(result) {
      assert.equal(result, "Ok!");
    }).then(done).catch(done);
  });

  it("should pass errors correctly", function(done) {
    var fn = function() {
      return Promise.reject("Argh!");
    };
    fn = timeoutPromise(fn, 50);

    expectRejection(fn()).then(function(error) {
      assert.equal(error, "Argh!");
    }).then(done).catch(done);
  });

  it("should return timeouts as errors", function(done) {
    var fn = timeoutPromise(waitThenReturnValue("Ok!", 20), 10);
    expectRejection(fn()).then(function(error) {
      assert.equal(error.code, "ETIMEDOUT");
    }).then(done).catch(done);
  });

});

function waitThenReturnValue(value, ms) {
  return function() {
    return waitFor(ms).then(function() {
      return value;
    });
  };
}

function failXTimesThenReturnArgument(times) {
  return function(result) {
    if (times-- > 0)
      return Promise.reject("Failing, " + times + " remaining!");
    else
      return Promise.resolve(result);
  };
}

function makeOneTimeDoublingFunction(delay) {
  var alreadyCalled = false;
  return function(value) {
    return new Promise(function(resolve) {
      if (alreadyCalled) return resolve("already-called");
      alreadyCalled = true;
      setTimeout(function() {
        resolve(value * 2);
      }, delay);
    });
  };
}
