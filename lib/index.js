var requestLib = require('request');
var Promise = require('bluebird');
var retry = require('./promise-utils').retryPromise;
var collapse = require('./promise-utils').collapsePromises;
var _ = require('underscore');

module.exports = goodGuyHttp;

var DEFAULT_SETTINGS = {
  // our defaults
  maxRetries: 2,
  collapseIdenticalRequests: true,
  returnExpired: true,
  cache: false,

  // default request-lib options
  timeout: 2000,
  gzip: true
};

var OUR_CONFIGURATION_PROPERTIES = [
  'maxRetries',
  'collapseIdenticalRequests',
  'returnExpired',
  'cache'
];

function goodGuyHttp(config) {
  // fill out anything missing in the configuration object
  config = _.defaults(config || {}, DEFAULT_SETTINGS);

  // split configuration into props handled by this lib
  // and props handled by the request lib
  var reqConfig = _.omit(config, OUR_CONFIGURATION_PROPERTIES);
  config = _.pick(config, OUR_CONFIGURATION_PROPERTIES);

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
    return checkForCachedResponse()
      .then(fetchIfNotCached);

    function checkForCachedResponse() {
      // mocked out for now
      return Promise.resolve(false);
    }

    function fetchIfNotCached(cachedResult) {
      var cachedResultShouldBeUsed = !!cachedResult;
      if (cachedResultShouldBeUsed)
        return cachedResult;
      else
        return fetchRequest(req);
    }
  }
}
