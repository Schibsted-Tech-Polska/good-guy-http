var util = require('util');

module.exports = HttpError;

function HttpError(request, response) {
  Error.call(this);
  this.code = "EHTTP";
  this.statusCode = response.statusCode;
  this.request = request;
  this.response = response;
  this.message = "HTTP error: status code " + this.statusCode;
}
util.inherits(HttpError, Error);
