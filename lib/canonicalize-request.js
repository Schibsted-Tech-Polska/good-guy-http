var _ = require('underscore');
module.exports = canonicalizeRequest;

/**
 * Canonicalizes a request object to ensure that the 'url' and 'method' properties
 * are always safe to access.
 * @param req the original request
 * @returns canonicalized object
 */
function canonicalizeRequest(req) {
  // resolve strings to request objects
  if (typeof req == 'string') {
    req = {url: req};
  }

  // add method if absent
  if (!req.method) {
    req = _.extend({method: 'GET'}, req);
  }

  // lowercase all headers
  req.headers = _.object(_.map(req.headers || {}, function(value, key) {
    return [key.toLowerCase(), value];
  }));

  return req;
}
