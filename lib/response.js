var _ = require('underscore');
var capitalize = require('capitalize');

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
    var self = this;

    var statusString = "HTTP/" + this.httpVersion + " " + this.statusCode;

    var sortedHeaders = _.keys(self.headers).sort();
    var headersString = sortedHeaders.map(function(header) {
      return capitalizeHeader(header) + ": " + self.headers[header];
    }).join("\r\n");

    return [statusString, headersString, "", this.body].join("\r\n");
  }
};

function capitalizeHeader(header) {
  return header.split("-").map(capitalize).join("-");
}
