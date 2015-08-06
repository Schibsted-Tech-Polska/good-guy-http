var _ = require('underscore');
module.exports = requestKey;

/**
 * Generates a cache key based on a request object.
 * @param req the request
 * @returns {String} a key
 */
function requestKey(req) {
  // if req seems to be an array, extract the first element as the actaul request
  // that happens when you use requestKey as the key function in collapsePromises
  if (req instanceof Array)
    req = req[0];

  // for now, we just use a combination of method, url and 'Accept' header as cache key
  // this does not work well with Vary - but well enough for most purposes
  var url = req.url, method = req.method, accept = req.headers['accept'];

  var keyComponents = [method, url];
  if (accept) {
    keyComponents.push("Accept:" + accept);
  }

  return keyComponents.join('|');
}

