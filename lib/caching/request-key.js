var _ = require('underscore');
var QueryString = require('request/lib/querystring').Querystring;

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

  // extract relevant parts of the request
  var url = req.url,
    method = req.method,
    accept = req.headers && req.headers['accept'],
    qs = req.qs;

  // a special consideration for the 'qs' and related options in the request lib
  // we use their own implementation to generate the correct query string and use
  // it as part of our key
  if (qs) {
    var reqLibStringifier = new QueryString(req);
    reqLibStringifier.init(req);
    url += "?" + reqLibStringifier.stringify(qs);
  }

  // for now, we just use a combination of method, url and 'Accept' header as cache key
  // this does not work well with Vary - but well enough for most purposes
  var keyComponents = [method, url];
  if (accept) {
    keyComponents.push("Accept:" + accept);
  }


  return keyComponents.join('|');
}

