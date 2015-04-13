var request = require('request');
var assert = require('assert');
var Promise = require('bluebird');
var expectRejection = require('./../helpers').expectRejection;

describe("Requesting with retries", function() {
  var app = require('./../test-app/test-app')();

  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it("shouldn't break requests that succeed immediately", function(done) {
    var gghttp = gghttpWithRetries(2);

    gghttp(app.url("/return-body/hello")).then(function(result) {
      assert.equal(result, "hello");
      done();
    }).catch(done);
  });

  it("should succeed if one of the retries succeeds", function(done) {
    var gghttp = gghttpWithRetries(2);
    gghttp(app.url("/fail-twice-then-succeed/id1")).then(function(result) {
      assert.equal(result, "Ok!");
      done();
    }).catch(done);
  });

  it("should fail with the last error if we run out of retries", function(done) {
    var gghttp = gghttpWithRetries(1);
    expectRejection(gghttp(app.url("/fail-twice-then-succeed/id2"))).then(function(err) {
      assert.equal(err.code, "EHTTP");
      assert.equal(err.status, 500);
      done();
    }).catch(done);
  });
});


function gghttpWithRetries(retries) {
  return require('../../')({maxRetries: retries, cache: false});
}
