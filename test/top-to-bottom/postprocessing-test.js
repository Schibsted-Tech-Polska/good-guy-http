var assert = require('assert');
var lib = require('../../');
var mockTimer = require('../helpers').mockTimer;
var wait = require('../helpers').waitFor;

describe("Postprocessing", function() {
  var app = require('./../test-app/test-app')();
  var lib = require('../../lib');
  var timer = mockTimer();


  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it('should work for uncached requests', function(done) {
    var gghttp = lib({cache: false, postprocess: extractBody});
    var url = app.url('/return-body/hello');
    gghttp(url).then(function(body) {
      assert.equal(body, 'hello');
    }).then(done).catch(done);
  });

  it('should work for cached requests with stale responses on', function(done) {
    var gghttp = lib({mockTimer: timer, postprocess: extractNumber});
    var url = app.url('/counter/ppswfcrwsron/cache-control/max-age=5');
    gghttp(url).then(function(n) {
      // fresh request
      assert.equal(n, 1);
      timer.advance(1000);
      return gghttp(url);
    }).then(function(n) {
      // cached request
      assert.equal(n, 1);
      timer.advance(5000);
      return gghttp(url);
    }).then(function(n) {
      // stale request
      assert.equal(n, 1);
      timer.advance(100);
      return wait(50).then(function() {
        return gghttp(url);
      });
    }).then(function(n) {
      // update in background
      assert.equal(n, 2);
    }).then(done).catch(done);
  });

  it('should work for cached requests with stale responses off', function(done) {
    var gghttp = lib({mockTimer: timer, postprocess: extractNumber, allowServingStale: false});
    var url = app.url('/counter/ppswfcrwsroff/cache-control/max-age=5');
    gghttp(url).then(function(n) {
      // fresh request
      assert.equal(n, 1);
      timer.advance(1000);
      return gghttp(url);
    }).then(function(n) {
      // cached request
      assert.equal(n, 1);
      timer.advance(5000);
      return gghttp(url);
    }).then(function(n) {
      // fresh request
      assert.equal(n, 2);
    }).then(done).catch(done);
  });

  it('should run only once for a set of collapsed requests', function(done) {
    var gghttp = lib({postprocess: extractBodyOnlyOnce()});
    var url = app.url('/delay-for-ms/10');
    Promise.all([gghttp(url), gghttp(url), gghttp(url)]).then(function(results) {
      assert.deepEqual(results, ["Ok!", "Ok!", "Ok!"]);
    }).then(done).catch(done);
  });
});

function extractBody(response) {
  return response.body;
}

function extractNumber(response) {
  return parseInt(response.body);
}

function extractBodyOnlyOnce() {
  var alreadyCalled = false;
  return function(response) {
    if (alreadyCalled) throw new Error("extractBodyOnlyOnce was called multiple times.");
    alreadyCalled = true;
    return response.body;
  };
}
