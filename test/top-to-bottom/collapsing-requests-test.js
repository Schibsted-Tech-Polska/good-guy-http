var assert = require('assert');
var Promise = require('bluebird');

describe("Requests with collapsing", function() {
  var app = require('./../test-app/test-app')();

  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it("should collapse identical requests by default", function(done) {
    var gghttp = require('../../')({cache: false});

    var url = app.url("/incrementing-counter/scirbd");
    Promise.all([gghttp(url), gghttp(url), gghttp(url)]).then(function(results) {
      assert.deepEqual(results, ['1','1','1']);
      done();
    }).catch(done);
  });

  it("shouldn't collapse even slightly different requests", function(done) {
    var gghttp = require('../../')({cache: false});
    var url = app.url("/incrementing-counter/sncesdr");
    var first = gghttp({url: url, timeout: 20});
    var second = gghttp({url: url, timeout: 21});
    Promise.all([first, second]).then(function(results) {
      assert.deepEqual(results.sort(), ['1', '2']);
      done();
    }).catch(done);
  });

  it("shouldn't collapse when explicitly turned off", function(done) {
    var gghttp = require('../../')({cache: false, collapseIdenticalRequests: false});

    var url = app.url("/incrementing-counter/sncweto");
    Promise.all([gghttp(url), gghttp(url), gghttp(url)]).then(function(results) {
      assert.deepEqual(results.sort(), ['1','2','3']);
      done();
    }).catch(done);
  });

  it("should make new requests if there is no ongoing request", function(done) {
    var gghttp = require('../../')({cache: false});
    var url = app.url("/incrementing-counter/smnritinor");
    gghttp(url).then(function(result) {
      assert.equal(result, '1');
      gghttp(url).then(function(result) {
        assert.equal(result, '2');
        done();
      });
    }).catch(done);
  });
});
