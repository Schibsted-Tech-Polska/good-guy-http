var util = require('util');

module.exports = HttpError;

function HttpError(status) {
  Error.call(this);
  this.code = "EHTTP";
  this.statusCode = status;
  this.message = "HTTP error: status code " + status;
}
util.inherits(HttpError, Error);
