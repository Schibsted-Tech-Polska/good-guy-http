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

  // responds "Ok!" after a delay of :ms milliseconds
  app.get('/delay-for-ms/:ms', function(req, res) {
    setTimeout(function() {
      res.status(200).send("Ok!");
    }, parseInt(req.params.ms));
  });

  // for each ID - fails 2 times with 500, then returns "Ok!"
  var fttsCounts = {};
  app.get('/fail-twice-then-succeed/:id', function(req, res) {
    var count = fttsCounts[req.params.id] || 0;
    fttsCounts[req.params.id] = count + 1;
    if (count >= 2)
      res.status(200).send("Ok!");
    else
      res.status(500).send("Oh my!");
  });

  // for each ID - returns an incrementing counter after a small delay, starting at 1 for the first request
  var icCounts = {};
  app.get('/incrementing-counter/:id', function(req, res) {
    var count = icCounts[req.params.id] || 1;
    icCounts[req.params.id] = count + 1;
    setTimeout(function() {
      res.status(200).send(count.toString());
    }, 10);
  });

  return app;
}
