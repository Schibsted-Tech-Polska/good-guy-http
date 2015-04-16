var _ = require('underscore');

module.exports = isIdempotent;

/**
 * Checks whether a request is cacheable. Currenlty this depends only on the HTTP method used.
 * @param req the request in question
 */
function isIdempotent(req) {
  return _.contains(IDEM_METHODS, req.method);
}

var IDEM_METHODS = ['GET', 'HEAD', 'OPTIONS'];
// PUT is also idempotent, but for our purposes it's better treated as if it isn't
