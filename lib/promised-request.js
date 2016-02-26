var Response = require('./response');
var HttpError = require('./http-error');
var requestKey = require('./caching/request-key');
var canonicalizeRequest = require('./canonicalize-request');

module.exports = promisedRequests;

function promisedRequests(request, Promise) {
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
    return new Promise(function(resolve, reject) {
      request(requestOptions, function(err, response) {
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
    });
  }

  /**
   * Adds request-specific information to the error to make it easier to debug problems.
   */
  function augmentError(err, request) {
    err.request = request;

    // add basic information about method/URL to the message
    var requestDescription = requestKey(canonicalizeRequest(request));
    var requestPrefix = "[While requesting " + requestDescription + "]: ";
    if (err.message) {
      err.message = requestPrefix + err.message;
    }
    if (err.stack) {
      err.stack = requestPrefix + err.stack;
    }

    return err;
  }
}

