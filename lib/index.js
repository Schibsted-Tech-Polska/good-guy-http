var _ = require('underscore');

var circuitBreaking = require('./circuit-breaking');

var nullCache = require('./caching/null-cache');
var lruCache  = require('./caching/lru-cache');

var canonicalizeRequest = require('./canonicalize-request');
var parseCacheSettings = require('./caching/parse-cache-settings');
var requestKey = require('./caching/request-key');
var groupByHost = require('./circuit-breaking/group-by-host');
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
  maxResponseSize: 1024*1024,         // responses are limited to a maximum of 1MB by default
  errorLogger: console.error,         // error logs will go to stderr
  logTiming: false,                   // log timing info to the console

  // if the server doesn't specify Cache-Control, default cache setup is caching for 5s
  defaultCaching: { cached: true, timeToLive: 5000, mustRevalidate: false },

  // if the servers you use give bogus Cache-Control, you can force goodguy to use different caching
  // settings
  forceCaching: undefined,

  // how should we treat 4xx errors - by default, we cache them since they're client errors
  // and are unlikely to fix themselves if we repeat the request
  // you can disable that by setting { cached: false } here
  clientErrorCaching: { cached: true, timeToLive: 60000, mustRevalidate: true },

  // gghttp uses the circuit breaker, with one breaker per target host
  // if too many requests fail, good guy will stop sending them and fail fast instead,
  // letting through "probe" requests periodically to see if the situation improved
  circuitBreaking: { errorThreshold: 50 },

  // undefined means built-in Promises will be chosen
  usePromise: Promise,

  // if needed, you can override the request lib used - just pass it in
  requestLib: require('request'),

  // settings for test purposes
  mockTimer: false,

  // default request-lib options
  timeout: 2000,                      // timeouts of 2s as a sane default
  gzip: true                          // gzipped responses handled by default
};

var OUR_CONFIGURATION_PROPERTIES = [
  'maxRetries',
  'maxResponseSize',
  'collapseIdenticalRequests',
  'allowServingStale',
  'cache',
  'cacheResponseTimeout',
  'errorLogger',
  'defaultCaching',
  'forceCaching',
  'clientErrorCaching',
  'circuitBreaking',
  'postprocess',
  'usePromise',
  'requestLib',
  'logTiming',
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

  // determine promises implementation
  if (config.usePromise === undefined)
    config.usePromise = global.Promise;
  var Promise = config.usePromise;

  // Set up timing
  if (config.logTiming)
    reqConfig.time = true;

  // sanitize configuration
  if (config.cache === undefined)
    config.cache = lruCache(undefined, Promise);
  if (config.cache === false)
    config.cache = nullCache(Promise);

  var promiseUtils = require('./promise-utils')(Promise);
  var retryPromise = promiseUtils.retryPromise;
  var collapsePromises = promiseUtils.collapsePromises;
  var timeoutPromise = promiseUtils.timeoutPromise;

  // set all the components up
  var request = config.requestLib.defaults(reqConfig);

  // cache retrieval should be gated with a timeout to prevent broken caches from braking the whole request
  var retrieveFromCache = config.cache.retrieve.bind(config.cache);
  if (config.cacheResponseTimeout)
    retrieveFromCache = timeoutPromise(retrieveFromCache, config.cacheResponseTimeout);

  // idempotent and non-idempotent requests have separate fetchers
  // with similar base functionality but different additional logic
  // we obviously aren't allowed to retry POST's and other non-idempotent requests
  var fetch = require('./promised-request')(request, Promise, _.pick(config, ['maxResponseSize', 'logTiming']));
  var fetchIdempotent = fetch, fetchNonIdempotent = fetch;
  if (config.maxRetries)
    fetchIdempotent = retryPromise(fetchIdempotent, config.maxRetries);
  if (config.circuitBreaking) {
    var cbConfig = { errorThreshold: config.circuitBreaking.errorThreshold || 50, promise: config.usePromise };
    fetchIdempotent = circuitBreaking(fetchIdempotent, groupByHost, cbConfig);
    fetchNonIdempotent = circuitBreaking(fetchNonIdempotent, groupByHost, cbConfig);
  }

  // time can be mocked for testing reasons
  var now = config.mockTimer || currentTimeInMs;

  // add convenience methods mirroring 'request' usage
  _.map(CONVENIENCE_METHODS, function(httpMethod, methodName) {
    makeRequest[methodName] = makeConvenienceMethod(httpMethod);
  });

  // add the ability to reconfigure good guy
  makeRequest.reconfigure = reconfigure;

  // for cacheable request, we can try to collapse identical requests into a single operation
  var processCacheableRequest = _processCacheableRequest;
  if (config.collapseIdenticalRequests)
    processCacheableRequest = collapsePromises(processCacheableRequest);

  // return the workhorse function
  return makeRequest;

  // ===========================================================

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

    // figure out which code path we should use
    var requestIsIdempotent = isIdempotent(req);
    if (requestIsIdempotent)
      return processCacheableRequest(req, requestKey(req));
    else
      return processUncacheableRequest(req);
  }

  function processUncacheableRequest(req) {
    // the flow for uncacheable requests is pretty simple
    return fetchIfNotCached(req, fetchNonIdempotent)(null)
      .then(postProcessIfRequested)
      .then(returnResultOrThrowError);
  }

  function _processCacheableRequest(req, cacheKey) {
    // the flow for potentially cacheable requests
    // includes additional cache lookup/update operations
    return getCachedResponse(cacheKey)
      .then(checkCachedEntryValidity(req, cacheKey))
      .then(fetchIfNotCached(req, fetchIdempotent))
      .then(postProcessIfRequested)
      .then(updateCache(cacheKey))
      .then(returnResultOrThrowError);
  }


  function getCachedResponse(cacheKey) {
    return retrieveFromCache(cacheKey).catch(function(err) {
      // cache errors are masked - better to make more requests when cache fails
      // than fail altogether
      config.errorLogger("Error retrieving key '" + cacheKey + "' from cache:\n", err.stack || err);
    });
  }

  function checkCachedEntryValidity(req, cacheKey) {
    return function (entry) {
      if (entry) {
        if (entry.expires < now()) {
          // handle expired entries - what we do now depends on whether
          // stale entries are considered OK for this request
          if (entry.allowServingStale && config.allowServingStale) {
            // yup, update the cache in background
              fetchInBackground(req)
                .then(postProcessIfRequested)
                .then(updateCache(cacheKey))
                .catch(function(err) {
                  config.errorLogger("Error during background fetch of '" + req.url + "':\n", err.stack || err);
                });
            // but still return stale value for now
            if (entry.data)
              entry.data.headers['x-gg-state'] = 'stale';
            return entry;
          } else {
            // if returning expired responses is disallowed, we treat
            // expired entries as missing
            return null;
          }
        } else {
          // valid entry inside its time-to-live
          if (entry.data)
            entry.data.headers['x-gg-state'] = 'cached';
          return entry;
        }
      } else {
        return null;
      }
    };
  }

  function fetchIfNotCached(req, fetchFn) {
    return function(entry) {
      if (entry) {
        return entry;
      } else {
        return fetchFn(req).then(function(response) {
          response.headers['x-gg-state'] = 'fresh';
          return {data: response};
        }).catch(function(error) {
          if (error.code == 'EHTTP' && error.statusCode >= 400 && error.statusCode <= 499) {
            // 4xx errors are cacheable, pass it forward
            return {error: error};
          } else {
            throw error;
          }
        });
      }
    };
  }

  function fetchInBackground(req) {
    return fetchIfNotCached(req, fetchIdempotent)(null);
  }

  function postProcessIfRequested(entry) {
    if (config.postprocess && (!entry.error) && (!entry.processed)) {
      entry.processed = config.postprocess(entry.data);
    }
    return entry;
  }

  function updateCache(cacheKey) {
    return function(entry) {
      var alreadyCached = !!entry.expires;
      if (alreadyCached)
        return entry;

      var cacheSettings;
      if (entry.error) {
        cacheSettings = config.clientErrorCaching;
      } else {
        cacheSettings = config.forceCaching || parseCacheSettings(entry.data) || config.defaultCaching;
      }

      if (cacheSettings.cached) {
        entry = _.extend(entry, {
          expires: now() + cacheSettings.timeToLive,
          allowServingStale: !cacheSettings.mustRevalidate
        });

        // trigger asynchronous cache update
        config.cache.store(cacheKey, entry)
          .catch(function(err) {
            config.errorLogger(err.stack || err);
          });
      }

      return entry;
    };
  }

  function returnResultOrThrowError(entry) {
    // cacheable 4xx errors arrive here and are only thrown at this point,
    // once the cache is already updated
    if (entry.error)
      throw entry.error;
    return config.postprocess ? entry.processed : entry.data;
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
