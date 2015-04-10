var assert = require('assert');
var Promise = require('bluebird');
var retryPromise = require('../lib/promise-utils').retryPromise;
var expectRejection = require('./helpers').expectRejection;

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

  it("should pass the last error on if retries are exhausted", function(done) {
    var testFn = failXTimesThenReturnArgument(3);
    var withRetries = retryPromise(testFn, 2);

    expectRejection(withRetries("Ok!")).then(function(err) {
      assert.equal(err, "Failing, 0 remaining!");
      done();
    }).catch(done);
  });


});

function failXTimesThenReturnArgument(times) {
  return function(result) {
    if (times-- > 0)
      return Promise.reject("Failing, " + times + " remaining!");
    else
      return Promise.resolve(result);
  };
}
