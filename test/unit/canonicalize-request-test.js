var assert = require('assert');
var _ = require('underscore');
var canonicalize = require('../../lib/canonicalize-request');

describe("Canonicalization of requests", function() {
  it('should turn strings to objects', function() {
    var req = "http://example.org";
    assert.deepEqual(canonicalize(req), {
      method: 'GET',
      url: req,
      headers: {}
    });
  });

  it('should provide method and headers if missing', function() {
    var req = {url: 'http://somewhere.org'};
    var canonical = canonicalize(req);
    assert.equal(canonical.method, 'GET');
    assert.deepEqual(canonical.headers, {});
  });

  it('should turn headers lowercase', function() {
    var req = {url: 'http://blah.org', headers: {
      'aCCEPT': 'application/json',
      'X-My-Fancy-KEY': 'my-key'
    }};
    var headers = canonicalize(req).headers;
    assert.deepEqual(_.keys(headers).sort(), ['accept', 'x-my-fancy-key']);
    assert.equal(headers.accept, 'application/json');
    assert.equal(headers['x-my-fancy-key'], 'my-key');
  });
});
