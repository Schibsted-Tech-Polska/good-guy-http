var sinon = require('sinon');
var Promise = require('bluebird');
var assert = require('assert');
var lib = require('../../');
var mockTimer = require('../helpers').mockTimer;

describe("Caching", function() {
  var app = require('./../test-app/test-app')();
  var timer = mockTimer();

  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it("should cache with the correct time-to-live", function(done) {
    var gghttp = lib({mockTimer: timer});

    var url = app.url('/counter/scwtcttl/cache-control/max-age=5');
    gghttp(url).then(function(res) {
      // first request should return a fresh response directly from the app
      expectResponse(res, '1', 'fresh');
      timer.advance(1000);
      return gghttp(url);
    }).then(function(res) {
      // cached response should still be valid
      expectResponse(res, '1', 'cached');
      timer.advance(5000);
      return gghttp(url);
    }).then(function(res) {
      // now, the response should be stale, but still returned
      // it should get update in the background
      expectResponse(res, '1', 'stale');

      // give some time for the background update to finish
      return wait(10).then(function() {
        timer.advance(1000);
        return gghttp(url);
      });
    }).then(function(res) {
      // this should be a response from the cache, since it should have been updated
      // in the previous step
      expectResponse(res, '2', 'cached');
    }).then(done).catch(done);
  });

  it("should respect must-revalidate", function(done) {
    var gghttp = lib({mockTimer: timer});

    var url = app.url('/counter/srmr/cache-control/max-age=5,must-revalidate');
    gghttp(url).then(function(res) {
      // first request should return a fresh response directly from the app
      expectResponse(res, '1', 'fresh');
      timer.advance(1000);
      return gghttp(url);
    }).then(function(res) {
      expectResponse(res, '1', 'cached');
      timer.advance(5000);
      return gghttp(url);
    }).then(function(res) {
      // now, the response should be fresh, since we won't serve stale stuff
      expectResponse(res, '2', 'fresh');
    }).then(done).catch(done);
  });

  it("should respect global 'allowServingStale' setting", function(done) {
    var gghttp = lib({mockTimer: timer, allowServingStale: false});

    var url = app.url('/counter/srgasss/cache-control/max-age=5');
    gghttp(url).then(function(res) {
      // first request should return a fresh response directly from the app
      expectResponse(res, '1', 'fresh');
      timer.advance(6000);
      return gghttp(url);
    }).then(function(res) {
      // now, the response should be fresh, since we aren't allowed to serve stale
      expectResponse(res, '2', 'fresh');
    }).then(done).catch(done);
  });

  it("should respect no-cache", function(done) {
    var gghttp = lib({mockTimer: timer});

    var url = app.url('/counter/srnc/cache-control/no-cache');
    gghttp(url).then(function(res) {
      // first request should return a fresh response directly from the app
      expectResponse(res, '1', 'fresh');
      timer.advance(1000);
      return gghttp(url);
    }).then(function(res) {
      // second response should also be fresh, since we're not allowed to cache
      expectResponse(res, '2', 'fresh');
    }).then(done).catch(done);
  });

  it("should cope with caching errors", function(done) {
    var loggerSpy = sinon.spy();
    var gghttp = lib({cache: faultyCache, errorLogger: loggerSpy});
    var url = app.url('/counter/scwce/cache-control/max-age=5');

    // requests should work despite the cache being completely broken
    gghttp(url).then(function(res) {
      expectResponse(res, '1', 'fresh');
      timer.advance(1000);
      return gghttp(url);
    }).then(function(res) {
      expectResponse(res, '2', 'fresh');
      assert.equal(loggerSpy.callCount, 4); // 4 errors should be logged, 2 per request
    }).then(done).catch(done);
  });
});


function expectResponse(response, body, ggState) {
  assert.equal(response.body, body);
  assert.equal(cacheState(response), ggState);
}

function cacheState(response) {
  return response.headers['x-gg-state'];
}

function wait(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

var faultyCache = {
  store: function() { return Promise.reject("AAAAAAA!"); },
  retrieve: function() { return Promise.reject("BBBBBB!"); }
};
