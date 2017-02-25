var sinon = require('sinon');
var assert = require('assert');
var lib = require('../../');
var mockTimer = require('../helpers').mockTimer;
var wait = require('../helpers').waitFor;
var slowCache = require('../helpers/slow-cache');
var _ = require('underscore');

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
      return wait(50).then(function() {
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

  it("should cope with slow caches by collapsing cache requests", function(done) {
    var cache = slowCache(25);
    var gghttp = lib({cache: cache});
    var url = app.url('/counter/scwscbccr/cache-control/max-age=5');
    var requests = _.map(_.range(5), function() {
      return gghttp(url);
    });

    Promise.all(requests).then(function(results) {
      var bodies = _.pluck(results, 'body');
      assert.deepEqual(bodies, ['1', '1', '1', '1', '1']);
      assert.equal(cache.retrievesCalled(), 1);
    }).then(done).catch(done);
  });

  it("should not send multiple cache store requests for concurrent requests to the same URL", function(done) {
    var cache = slowCache(5);
    var gghttp = lib({cache: cache});
    var url = app.url('/delay-for-ms/25');
    var requests = _.map(_.range(20), function() {
      return gghttp(url);
    });

    Promise.all(requests).then(function(results) {
      var bodies = _.pluck(results, 'body');
      assert.equal(cache.storesCalled(), 1);
    }).then(done).catch(done);
  });

  it("should cope with slow caches without making fetches incredibly long", function(done) {
    var cache = slowCache(3000);
    var gghttp = lib({cache: cache, cacheResponseTimeout: 20, errorLogger: function() {
    }});
    var url = app.url('/counter/scwscwmfil/cache-control/max-age=5');

    var startTime = (new Date()).getTime();
    gghttp(url).then(function() {
      var endTime = (new Date()).getTime();
      assert.ok((endTime - startTime) < 1000);
    }).then(done).catch(done);
  });

  it("should respect the cache response timeout set", function(done) {
    var cache = slowCache(30);
    var gghttp = lib({cache: cache, cacheResponseTimeout: 5, errorLogger: function() {
    }});
    var url = app.url('/counter/srtcrts/cache-control/max-age=5');

    // requests should work despite the cache not responding in time
    gghttp(url).then(function(res) {
      expectResponse(res, '1', 'fresh');
      return gghttp(url);
    }).then(function(res) {
      // this should be fresh since the cache should be ignored
      expectResponse(res, '2', 'fresh');
    }).then(done).catch(done);
  });

  it("should let the user force the caching settings", function(done) {
    var gghttp = lib({mockTimer: timer, forceCaching: {cached: true, timeToLive: 5000, mustRevalidate: false}});

    var url = app.url('/counter/sltuftcs/cache-control/no-cache,no-store,must-revalidate');
    gghttp(url).then(function(res) {
      // first request should return a fresh response directly from the app
      expectResponse(res, '1', 'fresh');
      timer.advance(1000);
      return gghttp(url);
    }).then(function(res) {
      // the second should be cached, despite the Cache-control header
      expectResponse(res, '1', 'cached');
      timer.advance(5000);
      return gghttp(url);
    }).then(function(res) {
      // this should be a stale response, since mustRevalidate was forced to false
      expectResponse(res, '1', 'stale');
    }).then(done).catch(done);
  });

  it("should differentiate between requests with different Accept", function(done) {
    var gghttp = lib({mockTimer: timer});

    var url = app.url('/counter/sdbrwda/cache-control/max-age=3600');
    gghttp({url: url, headers: {accept: 'application/json'}}).then(function(res) {
      // first request should return a fresh response directly from the app
      expectResponse(res, '1', 'fresh');
      timer.advance(1000);
      return gghttp({url: url, headers: {accept: 'text/plain'}});
    }).then(function(res) {
      // second response should also be fresh, since we're asking for different content type
      expectResponse(res, '2', 'fresh');
    }).then(done).catch(done);
  });

  it("should cache 4xx errors by default", function(done) {
    var gghttp = lib({mockTimer: timer});

    var url = app.url('/first-404-then-200/sc4xxebd');
    expectError(gghttp(url)).then(function(err) {
      assert.equal(err.statusCode, 404);
      timer.advance(1000);
      return expectError(gghttp(url));
    }).then(function(err) {
      // still 404 (the URL now returns 200, but it should not be re-fetched)
      assert.equal(err.statusCode, 404);
      timer.advance(120000);
      return gghttp(url);
    }).then(function(response) {
      // the cache should be expired by now, so we should get a fresh 200
      assert.equal(response.body, 'Ok.');
    }).then(done).catch(done);
  });

  it("should make it possible to turn off 4xx caching", function(done) {
    var gghttp = lib({mockTimer: timer, clientErrorCaching: {cached: false}});

    var url = app.url('/first-404-then-200/smiptto4xxc');
    expectError(gghttp(url)).then(function(err) {
      assert.equal(err.statusCode, 404);
      timer.advance(1000);
      return gghttp(url);
    }).then(function(response) {
      // now 200 (since we re-fetch without caching)
      assert.equal(response.body, "Ok.");
    }).then(done).catch(done);
  });

  it("should log background update errors", function(done) {
    var errorMsg = '';
    var gghttp = lib({mockTimer: timer, errorLogger: function(msg) {
      errorMsg = msg;
    }});

    var url = app.url('/succeed-then-fail/slbue/cache-control/max-age=5');
    gghttp(url).then(function(res) {
      // wait for cache expiration
      timer.advance(6000);
      return gghttp(url);
    }).then(function(res) {
      // give some time for the failed background update to finish
      return wait(50);
    }).then(function() {
      // error message should be populated by now
      assert.ok(errorMsg.indexOf('Error during background fetch') > -1);
    }).then(done).catch(done);
  });

});


function expectResponse(response, body, ggState) {
  assert.equal(response.body, body);
  assert.equal(cacheState(response), ggState);
}

function expectError(promise) {
  return new Promise(function(resolve, reject) {
    promise.then(function(result) {
      reject(new Error("Expected error, got " + result + " instead."));
    }).catch(function(err) {
      resolve(err);
    });
  });
}

function cacheState(response) {
  return response.headers['x-gg-state'];
}

var faultyCache = {
  store: function() { return Promise.reject("AAAAAAA!"); },
  retrieve: function() { return Promise.reject("BBBBBB!"); }
};
