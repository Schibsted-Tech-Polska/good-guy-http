var assert = require('assert');
var canonicalizeRequest = require('../../lib/canonicalize-request');
var requestKey = require('../../lib/caching/request-key');

describe("Request keys", function() {
  it("should be generated correctly for string requests", function() {
    var req = canonicalizeRequest("http://example.org");
    assert.equal(requestKey(req), 'GET|http://example.org');
  });

  it("should be generated correctly for object requests", function() {
    var req = canonicalizeRequest({url: 'http://example.org'});
    assert.equal(requestKey(req), 'GET|http://example.org');
  });

  it("should handle the 'qs' parameter correctly", function() {
    var req = canonicalizeRequest({url: 'http://example.org', qs: {a: 1, b: 2}});
    assert.equal(requestKey(req), 'GET|http://example.org?a=1&b=2');
  });

  it("should include accept header if provided", function() {
    var req = canonicalizeRequest({url: 'http://example.org', headers: {'AcCePt': 'application/json'}});
    assert.equal(requestKey(req), 'GET|http://example.org|Accept:application/json');
  });

  it("should work when request is wrapped in an array", function() {
    var req = canonicalizeRequest("http://example.org");
    assert.equal(requestKey([req]), 'GET|http://example.org');
  });

});
