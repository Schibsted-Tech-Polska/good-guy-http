var assert = require('assert');

describe("Request lib", function() {
  var app = require('./../test-app/test-app')();

  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it("should be taken from config, if provided", function(done) {
    var requestLib = require('request').defaults({baseUrl: app.url("/")});

    var gghttp = require('../../')({
      requestLib: requestLib
    });

    gghttp("/return-status/200").then(function(response) {
      assert.equal(response.statusCode, 200);
    }).then(done).catch(done);
  });
});
