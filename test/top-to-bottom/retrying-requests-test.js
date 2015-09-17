var assert = require('assert');
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
      assert.equal(result.body, "hello");
      done();
    }).catch(done);
  });

  it("should succeed if one of the retries succeeds", function(done) {
    var gghttp = gghttpWithRetries(2);
    gghttp(app.url("/fail-twice-then-succeed/id1")).then(function(result) {
      assert.equal(result.body, "Ok!");
      done();
    }).catch(done);
  });

  it("should fail with the last error if we run out of retries", function(done) {
    var gghttp = gghttpWithRetries(1);
    expectRejection(gghttp(app.url("/fail-twice-then-succeed/id2"))).then(function(err) {
      assert.equal(err.code, "EHTTP");
      assert.equal(err.statusCode, 500);
      done();
    }).catch(done);
  });

  it("should not retry if the response was a 4xx", function(done) {
    var gghttp = gghttpWithRetries(1);
    expectRejection(gghttp(app.url("/return-404-then-200/snritrwa4"))).then(function(err) {
      assert.equal(err.code, "EHTTP");
      assert.equal(err.statusCode, 404);
      done();
    }).catch(done);
  });
});


function gghttpWithRetries(retries) {
  return require('../../')({maxRetries: retries, collapseIdenticalRequests: false, cache: false});
}
