var assert = require('assert');
var requestKey = require('../../lib/caching/request-key');

describe("Request keys", function() {
  it("should be generated correctly for string requests", function() {
    var key = requestKey("http://example.org");
    assert.equal(key, 'http://example.org');
  });

  it("should be generated correctly for object requests", function() {
    var key = requestKey({url: 'http://example.org'});
    assert.equal(key, 'http://example.org');
  });

  it("should include accept header if provided", function() {
    var key = requestKey({url: 'http://example.org', headers: {'AcCePt': 'application/json'}});
    assert.equal(key, 'http://example.org[Accept:application/json]');
  });

});
