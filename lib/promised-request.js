var util = require('util');
var Response = require('./response');
var HttpError = require('./http-error');
var requestKey = require('./caching/request-key');
var canonicalizeRequest = require('./canonicalize-request');

module.exports = promisedRequests;

function promisedRequests(request, Promise, config) {
  config = config || {};
  var maxResponseSize = config.maxResponseSize || false;

  return makePromisedRequest;

  /**
   * Makes an HTTP request using the provided 'request' function
   * and returns a promise. This promise will resolve with the body
   * of the response, or reject with an error in case of a connection error
   * or an error-indicating HTTP status in the response.
   *
   * All the options are passed right through to 'request'.
   */
  function makePromisedRequest(requestOptions) {
    var externalReject;
    var externalHttpReq;

    var promise = new Promise(function(resolve, reject) {
      externalReject = reject;
      var httpReq = request(requestOptions, function(err, response) {
        if (config.logTiming) console.log('Timing: url: '  + response.request.uri.href
        + ' total: ' + response.timingPhases.total
        + ' wait: ' + response.timingPhases.wait
        + ' dns: ' + response.timingPhases.dns
        + ' tcp: ' + response.timingPhases.tcp
        + ' firstByte: ' + response.timingPhases.firstByte
        + ' download: ' + response.timingPhases.download);
        // hard errors cause a promise rejection
        if (err) {
          if (typeof err == 'object') {
            // add request-specific information to the error for easier debugging
            err = augmentError(err, requestOptions);
          }
          return reject(err);
        }

        // error-indicating HTTP statuses are also treated as errors, with a special
        // recognizable error type
        if (response.statusCode >= 400) {
          var httpError = new HttpError(requestOptions, new Response(response));
          return reject(httpError);
        }

        // but since everything went OK, we resolve with a cacheable response
        return resolve(new Response(response));
      });
      externalHttpReq = httpReq;

      // we want to bail early if a response goes over a chosen size
      if (maxResponseSize) {
        httpReq.on('data', abortIfResponseAbove(requestOptions, httpReq, maxResponseSize, reject));
      }
    });
    makePromisedRequestAbortable(promise, requestOptions, externalHttpReq, externalReject);
    return promise;
  }

  /**
   * Creates a 'data' event handler that will abort the request whenever
   * the server's response goes over a specified size limit.
   */
  function abortIfResponseAbove(requestOptions, httpRequest, maximumSize, rejectionCallback) {
    var sizeSoFar = 0;
    return function(chunk) {
      sizeSoFar += chunk.length;
      if (sizeSoFar > maximumSize) {
        // abort the actual Node request
        httpRequest.abort();

        // reject the promise with an appropriate error
        var err = new ResponseSizeExceededError("Response exceeded the maximum size of " + maximumSize + " bytes.");
        err = augmentError(err, requestOptions);
        rejectionCallback(err);
      }
    };
  }

  /**
   * Adds request-specific information to the error to make it easier to debug problems.
   */
  function augmentError(err, request) {
    request = canonicalizeRequest(request);

    // store for later reference by clients
    err.request = request;

    // add basic information about method/URL to the message
    var requestDescription = requestKey(request);
    var requestPrefix = "[While requesting " + requestDescription + "]: ";
    if (err.message) {
      err.message = requestPrefix + err.message;
    }
    if (err.stack) {
      err.stack = requestPrefix + err.stack;
    }

    return err;
  }

  function makePromisedRequestAbortable(promised, requestOptions, request, rejectionCallback) {
    promised.abort = function() {
      request.abort.call(request);
      var err = new AbortedRequestError();
      err = augmentError(err, requestOptions);
      rejectionCallback(err);
    };
  }
}

var ResponseSizeExceededError = module.exports.CircuitBrokenError = function(message) {
  Error.call(this);
  this.message = message;
  this.code = 'ERESPONSETOOBIG';
};
util.inherits(ResponseSizeExceededError, Error);

var AbortedRequestError = function() {
  Error.call(this);
  this.message = 'HTTP request aborted';
  this.code = 'EREQUESTABORTED';
  this.unretriable = true;
};
util.inherits(AbortedRequestError, Error);
