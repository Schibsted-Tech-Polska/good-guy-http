var _ = require('underscore');
var assert = require('assert');

describe('Reconfiguration', function() {
  var app = require('./../test-app/test-app')();
  var lib = require('../..');

  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it('should be possible for good guy parameters', function(done) {
    var gghttp = lib({collapseIdenticalRequests: true});
    var reconfigured = gghttp.reconfigure({collapseIdenticalRequests: false});
    var url = app.url("/incrementing-counter/rcsbpfggp");
    Promise.all([reconfigured(url), reconfigured(url)]).then(function(results) {
      results = _.pluck(results, 'body');
      assert.deepEqual(results.sort(), ['1','2']);
      done();
    }).catch(done);
  });

  it('should be possible for request parameters', function(done) {
    var gghttp = lib({timeout: 5});
    var reconfigured = gghttp.reconfigure({timeout: 50});
    var url = app.url("/delay-for-ms/10");
    reconfigured(url).then(function(response) {
      assert.equal(response.body, 'Ok!');
    }).then(done).catch(done);
  });

  it('should be possible via the request', function(done) {
    var gghttp = lib();
    var url = app.url('/return-body/hello');
    gghttp({url: url, postprocess: function(response) {
      return response.body.toUpperCase();
    }}).then(function(upperBody) {
      assert.equal(upperBody, 'HELLO');
    }).then(done).catch(done);
  });
});
