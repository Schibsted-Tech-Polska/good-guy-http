var requestLib = require('request');
var retry = require('./promise-utils').retryPromise;
var collapse = require('./promise-utils').collapsePromises;
var nullCache = require('./caching/null-cache');
var parseCacheSettings = require('./caching/parse-cache-settings');

var _ = require('underscore');

module.exports = goodGuyHttp;

var DEFAULT_SETTINGS = {
  // our defaults
  maxRetries: 2,
  collapseIdenticalRequests: true,
  returnExpired: true,
  cache: false,
  errorLogger: console.error,
  defaultCaching: { cached: true, timeToLive: 5000, mustRevalidate: false },

  // default request-lib options
  timeout: 2000,
  gzip: true
};

var OUR_CONFIGURATION_PROPERTIES = [
  'maxRetries',
  'collapseIdenticalRequests',
  'returnExpired',
  'cache',
  'errorLogger',
  'defaultCaching'
];

function goodGuyHttp(config) {
  // fill out anything missing in the configuration object
  config = _.defaults(config || {}, DEFAULT_SETTINGS);

  // split configuration into props handled by this lib
  // and props handled by the request lib
  var reqConfig = _.omit(config, OUR_CONFIGURATION_PROPERTIES);
  config = _.pick(config, OUR_CONFIGURATION_PROPERTIES);

  // sanitize configuration
  config.cache = config.cache || nullCache();

  // set all the components up
  var request = requestLib.defaults(reqConfig);

  var fetchRequest = require('./promised-request')(request);
  if (config.maxRetries)
    fetchRequest = retry(fetchRequest, config.maxRetries);
  if (config.collapseIdenticalRequests)
    fetchRequest = collapse(fetchRequest);

  // return the workhorse function
  return makeRequest;


  function makeRequest(req) {
    var cacheKey = req.url || req; // TODO: definitely *NOT* the way to do it in the final version
    var cache = config.cache;

    return getCachedResponse()
      .then(checkCachedEntryValidity)
      .then(fetchIfCacheInvalid);

    function getCachedResponse() {
      return cache.retrieve(cacheKey).catch(function(err) {
        // cache errors are masked - better to make more requests when cache fails
        // than fail altogether
        config.errorLogger(err.stack || err);
      });
    }

    function checkCachedEntryValidity(cachedEntry) {
      if (cachedEntry && cachedEntry.expires > now()) {
        // handle expired entries
        // what we do now depends on whether stale entries are OK for the user
        if (config.returnExpired) {
          // update the cache in background
          fetchRequest(req).then(updateCache);
          // but return stale value for now
          return cachedEntry;
        } else {
          // if returning expired responses is disallowed, we treat
          // expired entries as missing
          return null;
        }
      } else {
        return cachedEntry;
      }
    }

    function fetchIfCacheInvalid(cachedEntry) {
      if (cachedEntry) {
        return cachedEntry.data;
      } else {
        return fetchRequest(req).then(function(response) {
          updateCache(response); // update cache in background
          return response;       // return response immediately
        });
      }
    }

    function updateCache(response) {
      var settings = parseCacheSettings(response) || config.defaultCaching;
      if (settings.cached) {
        return cache.store(cacheKey, {
          data: response,
          expires: now() + settings.timeToLive,
          allowServingStale: !settings.mustRevalidate
        });
      } else {
        return Promise.resolve();
      }
    }
  }
}

function now() {
  return (new Date()).getTime();
}
