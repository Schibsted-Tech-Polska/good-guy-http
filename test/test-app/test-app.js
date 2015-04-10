var Promise = require('bluebird');
var express = require('express');
var http = require('http');

var DEFAULT_PORT = 13515;

module.exports = testApp;

/**
 * Sets up a web-app for testing, with a variety of endpoints doing various interesting
 * things.
 */
function testApp(port) {
  var server = null;
  var app = createExpressApp();
  port = port || DEFAULT_PORT;

  return {
    startListening: startListening,
    stopListening:  stopListening,
    url:            getUrl
  };

  function startListening() {
    return new Promise(function(resolve, reject) {
      server = http.createServer(app);
      server.listen(port, function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  function stopListening() {
    return new Promise(function(resolve) {
      server.close(function() {
        resolve();
      });
    });
  }

  function getUrl(url) {
    return 'http://localhost:' + port + url;
  }
}


/**
 * Creates a useful Express app with a few interesting endpoints.
 */
function createExpressApp() {
  var app = express();

  // returns an empty response and sends a chosen HTTP status
  app.get('/return-status/:status', function(req, res) {
    res.status(parseInt(req.params.status)).send("");
  });

  // returns a chosen body with HTTP status 200
  app.get('/return-body/:body', function(req, res) {
    res.status(200).send(req.params.body);
  });

  return app;
}
