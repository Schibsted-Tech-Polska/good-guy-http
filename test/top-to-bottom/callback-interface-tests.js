var assert = require('assert');

describe("Callback interface", function() {
  var app = require('./../test-app/test-app')();

  var gghttp = require('../../')();

  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it("should report successes correctly", function(done) {
    gghttp(app.url("/return-body/hello"), function(err, response) {
      assert(!err);
      assert(response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.body, 'hello');
      done();
    });
  });

  it("should report errors correctly", function(done) {
    gghttp(app.url("/return-status/404"), function(err, response) {
      assert(err);
      assert(!response);
      assert.equal(err.code, 'EHTTP');
      assert.equal(err.statusCode, 404);
      done();
    });
  });

  it("should work with convenience methods", function(done) {
    gghttp.get(app.url("/return-body/hello"), function(err, response) {
      assert(!err);
      assert(response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.body, 'hello');
      done();
    });
  });
});
