var util = require('util');

module.exports = HttpError;

function HttpError(request, response) {
  Error.call(this);
  this.code = "EHTTP";
  this.statusCode = response.statusCode;
  this.request = request;
  this.response = response;

  // requests causing client errors should not be retried, since this type of error doesn't fix itself
  if (response.statusCode >= 400 && response.statusCode <= 499)
    this.unretriable = true;

  this.message = "HTTP error: status code " + this.statusCode;
}
util.inherits(HttpError, Error);
