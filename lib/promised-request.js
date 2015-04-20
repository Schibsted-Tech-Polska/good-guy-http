var Promise = require('bluebird');
var Response = require('./response');
var HttpError = require('./http-error');

module.exports = promisedRequests;

function promisedRequests(request) {
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
        if (err) return reject(err);
        // error-indicating HTTP statuses are also treated as errors, with a special
        // recognizable error type
        if (response.statusCode >= 400) return reject(new HttpError(response.statusCode));

        // but since everything went OK, we resolve with a cacheable response
        return resolve(new Response(response));
      });
    });
  }
}
