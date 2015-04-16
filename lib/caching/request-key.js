var _ = require('underscore');
module.exports = requestKey;

/**
 * Generates a cache key based on a request object.
 * @param req the request
 * @returns {String} a key
 */
function requestKey(req) {
  // for now, we just use a combination of method, url and 'Accept' header as cache key
  // this does not work well with Vary - but well enough for most purposes
  var url = req.url, method = req.method, accept = req.headers['accept'];

  var keyComponents = [method, url];
  if (accept) {
    keyComponents.push("Accept:" + accept);
  }

  return keyComponents.join('|');
}

/**
 * Finds the value of a given header, handling arbitrary capitalization.
 * @param req the request
 * @param headerName the name of the header you're looking for
 */
function getHeader(req, headerName) {
  headerName = headerName.toLowerCase();
  return _.find(req.headers || {}, function(value, name) {
    return name.toLowerCase() == headerName;
  });
}
