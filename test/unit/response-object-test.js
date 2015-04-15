var Response = require('../../lib/response');
var assert = require('assert');

describe("Response object", function() {
  it("should have a string representation looking like a HTTP response", function() {
    var r = new Response({
      httpVersion: "1.1",
      statusCode: 200,
      headers: {
        'content-type': 'text/plain',
        'content-length': '6'
      },
      body: "Hello!"
    });

    var responseStr = r.toString();

    assert.equal(responseStr,
      "HTTP/1.1 200\r\n" +
      "Content-Length: 6\r\n" +
      "Content-Type: text/plain\r\n\r\n" +
      "Hello!"
    );
  });
});
