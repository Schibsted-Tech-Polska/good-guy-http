var assert = require('assert');
var parseCacheSettings = require('../../lib/caching/parse-cache-settings');

describe("Cache settings parser", function() {
  it("should obey Cache-Control: no-cache", function() {
    var settings = parseCacheSettings(responseWithCacheControl('no-cache'));
    assert.equal(settings.cached, false);
  });

  it("should obey Cache-Control: no-store", function() {
    var settings = parseCacheSettings(responseWithCacheControl('no-store'));
    assert.equal(settings.cached, false);
  });

  it("should obey Cache-Control: max-age", function() {
    var settings = parseCacheSettings(responseWithCacheControl('max-age=60'));
    assert.equal(settings.cached, true);
    assert.equal(settings.timeToLive, 60000);
    assert.equal(settings.mustRevalidate, false);
  });

  it("should obey Cache-Control: must-revalidate", function() {
    var settings = parseCacheSettings(responseWithCacheControl('max-age=60, must-revalidate'));
    assert.equal(settings.cached, true);
    assert.equal(settings.timeToLive, 60000);
    assert.equal(settings.mustRevalidate, true);
  });

  it("should return undefined if it doesn't parse anything", function() {
    var settings = parseCacheSettings(responseWithCacheControl('a monkey typed this in'));
    assert.strictEqual(settings, undefined);
  });
});

function responseWithCacheControl(cacheControl) {
  return {
    httpVersion: "1.1",
    statusCode: 200,
    headers: {
      'cache-control': cacheControl
    },
    body: 'Hello!'
  };
}
