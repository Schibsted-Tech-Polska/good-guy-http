var _ = require('underscore');

module.exports = isCacheable;

/**
 * Checks whether a request is cacheable. Currenlty this depends only on the HTTP method used.
 * @param req the request in question
 */
function isCacheable(req) {
  return _.contains(CACHEABLE_METHODS, req.method);
}

var CACHEABLE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
