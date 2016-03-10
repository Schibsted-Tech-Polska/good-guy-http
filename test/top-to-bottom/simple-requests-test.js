var assert = require('assert');
var expectRejection = require('./../helpers').expectRejection;

describe("Good guy HTTP", function() {
  var app = require('./../test-app/test-app')();

  var gghttp = require('../../')({
    maxRetries: 0,
    collapseIdenticalRequests: false,
    cache: false
  });

  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it("should resolve with a response on success", function(done) {
    gghttp(app.url("/return-body/hello")).then(function(result) {
      assert.equal(result.httpVersion, "1.1");
      assert.equal(result.statusCode, 200);
      assert.equal(result.body, "hello");
      done();
    }).catch(done);
  });

  it("should provide correct headers", function(done) {
    gghttp(app.url("/return-header/X-Hello/world!")).then(function(result) {
      assert.equal(result.headers['x-hello'], 'world!');
      done();
    }).catch(done);
  });

  it("should reject the promise on 4xx HTTP status", function(done) {
    expectRejection(gghttp(app.url("/return-status/404"))).then(function(err) {
      assert.equal(err.code, "EHTTP");
      assert.equal(err.message, "HTTP error: status code 404");
      assert.equal(err.statusCode, 404);
      done();
    }).catch(done);
  });

  it("should reject the promise on 5xx HTTP status", function(done) {
    expectRejection(gghttp(app.url("/return-status/500"))).then(function(err) {
      assert.equal(err.code, "EHTTP");
      assert.equal(err.message, "HTTP error: status code 500");
      assert.equal(err.statusCode, 500);
      done();
    }).catch(done);
  });

  it("should reject when the request times out", function(done) {
    expectRejection(gghttp({
      url: app.url("/delay-for-ms/2000"),
      timeout: 10
    })).then(function(err) {
      assert(err.code == "ETIMEDOUT" || err.code == "ESOCKETTIMEDOUT");
      done();
    }).catch(done);
  });

  it("should reject when connection fails", function(done) {
    expectRejection(gghttp("http://127.0.0.1:1")).then(function(err) {
      assert.equal(err.code, "ECONNREFUSED");
      done();
    }).catch(done);
  });
});
