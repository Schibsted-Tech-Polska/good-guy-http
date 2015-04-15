var _ = require('underscore');

module.exports = Response;

/**
 * The actual HTTP response object used by request (and node itself) is not cacheable.
 * Response is a cacheable object with all the important things in the same
 * places as in the official one.
 */
function Response(response) {
  // copy relevant information from the response
  _.extend(this, _.pick(response, ['httpVersion', 'statusCode', 'headers', 'body']));
}
Response.prototype = {
  toString: function() {
    var statusString = "HTTP/" + this.httpVersion + " " + this.statusCode;
    var headersString = _.map(this.headers, function(value, name) {
      return name + ": " + value;
    }).join("\n");

    return [statusString, headersString, "", this.body].join("\n");
  }
};
