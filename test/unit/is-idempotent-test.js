var assert = require('assert');
var isIdempotent = require('../../lib/caching/is-idempotent');

describe("isIdempotent()", function() {
  it('should report true for read-only HTTP methods if idempotence was not defined', function() {
    var methods = ['HEAD', 'GET', 'OPTIONS'];
    var requests = methods.map(function(method) {
      return {url: 'http://blah.org', method: method};
    });

    assert.deepEqual(requests.map(isIdempotent), [true, true, true]);
  });

  it('should report false for non-idempotent and mutating HTTP methods if idempotence was not defined', function() {
    // PUT is idempotent, but for our purposes it's better treated as if it isn't
    var methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    var requests = methods.map(function(method) {
      return {url: 'http://blah.org', method: method};
    });

    assert.deepEqual(requests.map(isIdempotent), [false, false, false, false]);
  });

  it('should report false for read-only HTTP methods if idempotence was defined to be false', function() {
    var methods = ['HEAD', 'GET', 'OPTIONS'];
    var requests = methods.map(function(method) {
      return {url: 'http://blah.org', method: method, idempotent: false};
    });

    assert.deepEqual(requests.map(isIdempotent), [false, false, false]);
  });

  it('should report true for non-idempotent and mutating HTTP methods if idempotence was defined to be true',
    function() {
      // PUT is idempotent, but for our purposes it's better treated as if it isn't
      var methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      var requests = methods.map(function(method) {
        return {url: 'http://blah.org', method: method, idempotent: true};
      });

      assert.deepEqual(requests.map(isIdempotent), [true, true, true, true]);
    });
});
