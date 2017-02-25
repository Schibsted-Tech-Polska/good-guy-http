var _ = require('underscore');
var assert = require('assert');
var lib = require('../../');
var mockTimer = require('../helpers').mockTimer;
var expectRejection = require('../helpers').expectRejection;

describe('Non-idempotent requests', function() {
  var app = require('./../test-app/test-app')();
  var timer = mockTimer();

  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it('should not be cached', function(done) {
    var gghttp = lib({mockTimer: timer});

    var url = app.url('/counter/nirsnbc/cache-control/max-age=5');
    gghttp.post(url).then(function(res) {
      // first request should return a fresh response directly from the app
      assert.equal(res.body, '1');
      assert.equal(res.headers['x-gg-state'], 'fresh');
      timer.advance(1000);
      return gghttp.post(url);
    }).then(function(res) {
      // second request should be made afresh since we're not allowed to cache
      assert.equal(res.body, '2');
      assert.equal(res.headers['x-gg-state'], 'fresh');
    }).then(done).catch(done);
  });

  it('should not be retried', function(done) {
    var gghttp = lib({maxRetries: 10});
    var url = app.url('/fail-twice-then-succeed/nirsnbr');
    expectRejection(gghttp.post(url)).then(function(err) {
      assert.equal(err.code, 'EHTTP');
      assert.equal(err.statusCode, 500);
    }).then(done).catch(done);
  });

  it('should not be collapsed', function(done) {
    var gghttp = lib({collapseIdenticalRequests: true});

    var url = app.url("/incrementing-counter/nirsncollapsed");
    Promise.all([gghttp.post(url), gghttp.post(url), gghttp.post(url)]).then(function(results) {
      results = _.pluck(results, 'body');
      assert.deepEqual(results.sort(), ['1','2','3']);
      done();
    }).catch(done);
  });
});
