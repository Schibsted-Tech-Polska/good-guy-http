module.exports = parseCachingSettings;

var RE_MAX_AGE = /max-age=(\d+)/;
var RE_MUST_REVALIDATE = /must-revalidate/;
var RE_NO_CACHING = /no-cache|no-store/;

function parseCachingSettings(response) {
  var header = response.headers['cache-control'];
  if (!header)
    return undefined;

  // no-cache or no-store?
  if (RE_NO_CACHING.test(header)) {
    return {
      cached: false
    };
  }

  // max-age=<seconds> specified?
  var maxAgeMatch = RE_MAX_AGE.exec(header);
  if (maxAgeMatch) {
    var timeInSeconds = parseInt(maxAgeMatch[1]);
    return {
      cached: true,
      timeToLive: timeInSeconds * 1000,
      mustRevalidate: RE_MUST_REVALIDATE.test(header)
    };
  }

  // nothing we can understand found in Cache-Control
  return undefined;
}
