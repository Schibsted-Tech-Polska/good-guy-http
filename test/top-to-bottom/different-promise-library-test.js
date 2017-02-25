var assert = require('assert');
var expectRejection = require('./../helpers').expectRejection;

describe("Use different Promise library", function() {
  var app = require('./../test-app/test-app')();

  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it("should use built-in Promises by default", function(done) {
    var gghttp = require('../../')({
      maxRetries: 0,
      collapseIdenticalRequests: false,
      cache: false
    });

    var promise = gghttp(app.url("/return-body/hello")).then(function () {
      assert.ok(promise instanceof Promise);
      done();
    }).catch(done);
  });

  it("should use custom constructor, if provided", function(done) {
    var qPromise = require('q').Promise;

    var gghttp = require('../../')({
      maxRetries: 0,
      collapseIdenticalRequests: false,
      cache: false,
      usePromise: qPromise
    });

    var promise = gghttp(app.url("/return-body/hello")).then(function () {
      assert.ok('ninvoke' in promise);

      done();
    }).catch(done);
  });
});
