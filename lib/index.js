var requestLib = require('request');
var Promise = require('bluebird');
var _ = require('underscore');
var retry = require('./promise-utils').retryPromise;
var collapse = require('./promise-utils').collapsePromises;
var nullCache = require('./caching/null-cache');
var lruCache  = require('./caching/lru-cache');

var canonicalizeRequest = require('./canonicalize-request');
var parseCacheSettings = require('./caching/parse-cache-settings');
var requestKey = require('./caching/request-key');
var isIdempotent = require('./caching/is-idempotent');

module.exports = goodGuyHttp;
module.exports.inMemoryCache = lruCache;

var DEFAULT_SETTINGS = {
  // our defaults
  maxRetries: 2,                      // failing requests are retried twice
  collapseIdenticalRequests: true,    // identical requests ARE collapsed
  allowServingStale: true,            // stale content is served and updated in background
  cache: undefined,                   // in-memory cache created-per-instance will be used
  cacheResponseTimeout: 500,          // if a cache fails to respond in 500ms, it will be ignored
  errorLogger: console.error,         // error logs will go to stderr
  defaultCaching: { cached: true, timeToLive: 5000, mustRevalidate: false }, // default cache time is 5s if the server doesn't specify Cache-Control
  mockTimer: false,

  // default request-lib options
  timeout: 2000,                      // timeouts of 2s as a sane default
  gzip: true                          // gzipped responses handled by default
};

var OUR_CONFIGURATION_PROPERTIES = [
  'maxRetries',
  'collapseIdenticalRequests',
  'allowServingStale',
  'cache',
  'cacheResponseTimeout',
  'errorLogger',
  'defaultCaching',
  'postprocess',

  'mockTimer'
];

var CONVENIENCE_METHODS = {
  'head': 'HEAD',
  'get': 'GET',
  'post': 'POST',
  'put': 'PUT',
  'del': 'DELETE',
  'patch': 'PATCH'
};

function goodGuyHttp(config) {
  // fill out anything missing in the configuration object
  config = _.defaults(config || {}, DEFAULT_SETTINGS);

  // split configuration into props handled by this lib
  // and props handled by the request lib
  var reqConfig = _.omit(config, OUR_CONFIGURATION_PROPERTIES);
  config = _.pick(config, OUR_CONFIGURATION_PROPERTIES);

  // sanitize configuration
  if (config.cache === undefined)
    config.cache = lruCache();
  if (config.cache === false)
    config.cache = nullCache();

  // set all the components up
  var request = requestLib.defaults(reqConfig);

  // getCachedResponse() gets collapsed responses too - we don't want to make extraneous DB calls
  var getCachedResponse = collapse(_getCachedResponse);

  // idempotent and non-idempotent requests have separate fetchers
  // with similar base functionality but different retry/collapse/cache logic
  var fetch = require('./promised-request')(request);
  var fetchIdempotent = fetch, fetchNonIdempotent = fetch;
  if (config.maxRetries)
    fetchIdempotent = retry(fetchIdempotent, config.maxRetries);
  if (config.collapseIdenticalRequests)
    fetchIdempotent = collapse(fetchIdempotent);

  // time can be mocked for testing reasons
  var now = config.mockTimer || currentTimeInMs;

  // add convenience methods mirroring 'request' usage
  _.map(CONVENIENCE_METHODS, function(httpMethod, methodName) {
    makeRequest[methodName] = makeConvenienceMethod(httpMethod);
  });

  // add the ability to reconfigure good guy
  makeRequest.reconfigure = reconfigure;

  // return the workhorse function
  return makeRequest;

  function makeRequest(req, callback) {
    // are there new configuration parameters in the request?
    var additionalRequestConfig = _.pick(req, OUR_CONFIGURATION_PROPERTIES);
    if (!_.isEmpty(additionalRequestConfig)) {
      // do it via a temporary goodguy with the configuration added in
      req = _.omit(req, OUR_CONFIGURATION_PROPERTIES);
      return reconfigure(additionalRequestConfig)(req, callback);
    }

    // callback version of the interface - it's a simple wrapper on top
    // of the standard promise-based version
    if (callback) {
      return makeRequest(req).then(function(response) {
        process.nextTick(function() {  // nextTick used to separate from the promise call-chain
          callback(null, response);
        });
      }).catch(function(err) {
        process.nextTick(function() {
          callback(err);
        });
      });
    }

    // get canonical form to ensure all helpers find what they need
    req = canonicalizeRequest(req);

    // figure out whether we should be using cache
    var requestIsIdempotent = isIdempotent(req);
    var fetchFn = requestIsIdempotent ? fetchIdempotent : fetchNonIdempotent;

    var cachedResponse;
    if (requestIsIdempotent) {
      var cacheKey = requestKey(req);
      cachedResponse = getCachedResponse(cacheKey);
    } else {
      cachedResponse = Promise.resolve(null);
    }

    return cachedResponse
      .then(checkCachedEntryValidity)
      .then(fetchIfCacheInvalid)
      .then(postProcessIfRequested)
      .then(updateCache)
      .then(returnResult);

    // =====

    function checkCachedEntryValidity(entry) {
      if (entry) {
        if (entry.expires < now()) {
          // handle expired entries - what we do now depends on whether
          // stale entries are considered OK for this request
          if (entry.allowServingStale && config.allowServingStale) {
            // yup, update the cache in background
            fetchInBackground().then(postProcessIfRequested).then(updateCache);
            // but still return stale value for now
            entry.data.headers['x-gg-state'] = 'stale';
            return entry;
          } else {
            // if returning expired responses is disallowed, we treat
            // expired entries as missing
            return null;
          }
        } else {
          // valid entry inside its time-to-live
          entry.data.headers['x-gg-state'] = 'cached';
          return entry;
        }
      } else {
        return null;
      }
    }

    function fetchIfCacheInvalid(entry) {
      if (entry) {
        return entry;
      } else {
        return fetchFn(req).then(function(response) {
          response.headers['x-gg-state'] = 'fresh';
          return {data: response};
        });
      }
    }

    function fetchInBackground() {
      return fetchIfCacheInvalid(null);
    }

    function postProcessIfRequested(entry) {
      if (config.postprocess && (!entry.processed)) {
        entry.processed = config.postprocess(entry.data);
      }
      return entry;
    }

    function updateCache(entry) {
      if (!requestIsIdempotent) return entry;

      var alreadyCached = !!entry.expires;
      if (alreadyCached)
        return entry;

      var settings = parseCacheSettings(entry.data) || config.defaultCaching;
      if (settings.cached) {
        entry = _.extend(entry, {
          expires: now() + settings.timeToLive,
          allowServingStale: !settings.mustRevalidate
        });
        return config.cache.store(cacheKey, entry)
          .then(function() {
            return entry;
          }).catch(function(err) {
            config.errorLogger(err.stack || err);
            return entry;
          });
      } else {
        return entry;
      }
    }

    function returnResult(entry) {
      return config.postprocess ? entry.processed : entry.data;
    }
  }

  function _getCachedResponse(cacheKey, requestIsIdempotent) {
    return config.cache.retrieve(cacheKey).catch(function(err) {
      // cache errors are masked - better to make more requests when cache fails
      // than fail altogether
      config.errorLogger(err.stack || err);
    });
  }

  function makeConvenienceMethod(httpMethod) {
    return function(req, callback) {
      if (typeof req == 'string')
        req = {url: req};
      req.method = httpMethod;
      return makeRequest(req, callback);
    };
  }

  function reconfigure(additionalConfig) {
    var newConfig = _.extend({}, config, additionalConfig);
    return goodGuyHttp(newConfig);
  }
}

function currentTimeInMs() {
  return (new Date()).getTime();
}
