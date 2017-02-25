var _ = require('underscore');
var assert = require('assert');

describe("Convenience methods", function() {
  var app = require('./../test-app/test-app')();

  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it("should use correct HTTP methods for requests", function(done) {
    var gghttp = require('../../lib')();
    var methods = ['get', 'post', 'del', 'patch', 'put', 'head'];
    var requests = methods.map(function(method) {
      return gghttp[method](app.url('/return-method-used/' + method));
    });
    Promise.all(requests).then(function(responses) {
      var reportedMethods = _.map(responses, function(res) {
        return res.headers['x-method'];
      });
      assert.deepEqual(reportedMethods, ['GET', 'POST', 'DELETE', 'PATCH', 'PUT', 'HEAD']);
    }).then(done).catch(done);
  });
});
