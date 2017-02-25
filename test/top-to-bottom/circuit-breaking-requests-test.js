var assert = require('assert');
var _ = require('underscore');
var lib = require('../../');
var expectRejection = require('../helpers').expectRejection;

describe("Circuit breaking", function() {
  var testApp = require('./../test-app/test-app');
  var app = testApp(testApp.DEFAULT_PORT);
  var app2 = testApp(testApp.DEFAULT_PORT + 1);

  before(function(done) {
    Promise.all([app.startListening(), app2.startListening()])
      .then(function() { done(); })
      .catch(done);
  });
  after(function(done) {
    Promise.all([app.stopListening(), app2.stopListening()])
      .then(function() { done(); })
      .catch(done);
  });

  it("should kick in after enough requests fail with a 5xx error", function(done) {
    var gghttp = lib({collapseIdenticalRequests: false});
    var url = app.url('/return-status/500');

    // these requests should trip the circuit breaker
    var setupRequests = _.range(30).map(function() { return gghttp(url).catch(function(){}); });

    Promise.all(setupRequests).then(function() {
      // the breaker should be open by now, so this will fail with an ECIRCUIT (even though it would work if called)
      return expectRejection(gghttp(app.url('/return-status/200')));
    }).then(function(err) {
      assert.equal(err.code, 'ECIRCUIT');
    }).then(done).catch(done);
  });

  it("should use separate breakers for different hosts", function(done) {
    var gghttp = lib({collapseIdenticalRequests: false});
    var url = app.url('/return-status/500');

    // these requests should trip the circuit breaker
    var setupRequests = _.range(30).map(function() { return gghttp(url).catch(function(){}); });

    Promise.all(setupRequests).then(function() {
      // the breaker for 'app should be open by now
      return expectRejection(gghttp(app.url('/return-status/200')));
    }).then(function(err) {
      assert.equal(err.code, 'ECIRCUIT');
      // but app2 should work since it's a separate host
      return gghttp(app2.url('/return-status/200'));
    }).then(function(response) {
      assert.equal(response.statusCode, 200);
    }).then(done).catch(done);
  });

  it("should be possible to turn off", function(done) {
    var gghttp = lib({collapseIdenticalRequests: false, circuitBreaking: false});
    var url = app.url('/return-status/500');

    // these requests should trip the circuit breaker
    var setupRequests = _.range(30).map(function() { return gghttp(url).catch(function(){}); });

    Promise.all(setupRequests).then(function() {
      // if circuit breaking was on, the breaker should be open by now
      return gghttp(app.url('/return-status/200'));
    }).then(function(response) {
      assert.equal(response.statusCode, 200);
    }).then(done).catch(done);
  });
});
