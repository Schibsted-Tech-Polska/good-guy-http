var assert = require('assert');
var isCacheable = require('../../lib/caching/is-cacheable');

describe("isCacheable()", function() {
  it('should allow caching idempotent, read-only HTTP methods', function() {
    var methods = ['HEAD', 'GET', 'OPTIONS'];
    var requests = methods.map(function(method) {
      return {url: 'http://blah.org', method: method};
    });

    assert.deepEqual(requests.map(isCacheable), [true, true, true]);
  });

  it('should disallow caching for mutating HTTP methods', function() {
    var methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    var requests = methods.map(function(method) {
      return {url: 'http://blah.org', method: method};
    });

    assert.deepEqual(requests.map(isCacheable), [false, false, false, false]);
  });
});
