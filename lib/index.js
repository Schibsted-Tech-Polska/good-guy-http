var requestLib = require('request');
var Promise = require('bluebird');
var _ = require('underscore');
var retry = require('./promise-utils').retryPromise;
var collapse = require('./promise-utils').collapsePromises;
var nullCache = require('./caching/null-cache');
var lruCache  = require('./caching/lru-cache');
var parseCacheSettings = require('./caching/parse-cache-settings');
var requestKey = require('./caching/request-key');

module.exports = goodGuyHttp;

var DEFAULT_SETTINGS = {
  // our defaults
  maxRetries: 2,
  collapseIdenticalRequests: true,
  allowServingStale: true,
  cache: undefined,
  errorLogger: console.error,
  defaultCaching: { cached: true, timeToLive: 5000, mustRevalidate: false },
  mockTimer: false,

  // default request-lib options
  timeout: 2000,
  gzip: true
};

var OUR_CONFIGURATION_PROPERTIES = [
  'maxRetries',
  'collapseIdenticalRequests',
  'allowServingStale',
  'cache',
  'errorLogger',
  'defaultCaching',
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

  var fetchRequest = require('./promised-request')(request);
  if (config.maxRetries)
    fetchRequest = retry(fetchRequest, config.maxRetries);
  if (config.collapseIdenticalRequests)
    fetchRequest = collapse(fetchRequest);

  var now = config.mockTimer || currentTimeInMs;

  // add convenience methods mirroring 'request' usage
  _.map(CONVENIENCE_METHODS, function(httpMethod, methodName) {
    makeRequest[methodName] = makeConvenienceMethod(httpMethod);
  });

  // return the workhorse function
  return makeRequest;


  function makeRequest(req, callback) {
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

    // figure out the cache key for the request
    var cacheKey = requestKey(req);

    // go!
    return getCachedResponse()
      .then(checkCachedEntryValidity)
      .then(fetchIfCacheInvalid);

    // =====

    function getCachedResponse() {
      return config.cache.retrieve(cacheKey).catch(function(err) {
        // cache errors are masked - better to make more requests when cache fails
        // than fail altogether
        config.errorLogger(err.stack || err);
      });
    }

    function checkCachedEntryValidity(cachedEntry) {
      if (cachedEntry) {
        if (cachedEntry.expires < now()) {
          // handle expired entries - what we do now depends on whether
          // stale entries are considered OK for this request
          if (cachedEntry.allowServingStale && config.allowServingStale) {
            // yup, update the cache in background
            fetchRequest(req).then(updateCache);
            // but still return stale value for now
            cachedEntry.data.headers['x-gg-state'] = 'stale';
            return cachedEntry;
          } else {
            // if returning expired responses is disallowed, we treat
            // expired entries as missing
            return null;
          }
        } else {
          // valid entry inside its time-to-live
          cachedEntry.data.headers['x-gg-state'] = 'cached';
          return cachedEntry;
        }
      } else {
        return null;
      }
    }

    function fetchIfCacheInvalid(cachedEntry) {
      if (cachedEntry) {
        return cachedEntry.data;
      } else {
        return fetchRequest(req).then(function(response) {
          response.headers['x-gg-state'] = 'fresh';
          updateCache(response); // update cache in background
          return response;       // return response immediately
        });
      }
    }

    function updateCache(response) {
      var settings = parseCacheSettings(response) || config.defaultCaching;
      if (settings.cached) {
        return config.cache.store(cacheKey, {
          data: response,
          expires: now() + settings.timeToLive,
          allowServingStale: !settings.mustRevalidate
        }).catch(function(err) {
          config.errorLogger(err.stack || err);
        });
      } else {
        return Promise.resolve();
      }
    }
  }

  function makeConvenienceMethod(httpMethod) {
    return function(req, callback) {
      if (typeof req == 'string')
        req = {url: req};
      req.method = httpMethod;
      return makeRequest(req, callback);
    };
  }
}

function currentTimeInMs() {
  return (new Date()).getTime();
}
