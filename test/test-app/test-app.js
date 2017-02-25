var express = require('express');
var http = require('http');

var DEFAULT_PORT = 13515;

module.exports = testApp;
module.exports.DEFAULT_PORT = DEFAULT_PORT;

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

  // returns a chosen header with HTTP status 200
  app.get('/return-header/:name/:value', function(req, res) {
    res.status(200).set(req.params.name, req.params.value).send("Ok!");
  });

  // responds "Ok!" after a delay of :ms milliseconds
  app.get('/delay-for-ms/:ms', function(req, res) {
    setTimeout(function() {
      res.status(200).send("Ok!");
    }, parseInt(req.params.ms));
  });

  // responds with a body of the chosen size
  app.get('/response-size/:bytes', function(req, res) {
    var size = parseInt(req.params.bytes);
    res.set({'content-type': 'application/octet-stream'});
    res.status(200).send(new Buffer(size)).end();
  });

  // for each ID - fails 2 times with 500, then returns "Ok!"
  var fttsCounts = {};
  app.all('/fail-twice-then-succeed/:id', function(req, res) {
    var count = fttsCounts[req.params.id] || 0;
    fttsCounts[req.params.id] = count + 1;
    if (count >= 2)
      res.status(200).send("Ok!");
    else
      res.status(500).send("Oh my!");
  });

  // for each ID - returns an incrementing counter after a small delay, starting at 1 for the first request
  var icCounts = {};
  app.all('/incrementing-counter/:id', function(req, res) {
    var count = icCounts[req.params.id] || 1;
    icCounts[req.params.id] = count + 1;
    setTimeout(function() {
      res.status(200).send(count.toString());
    }, 50);
  });

  // incrementing counter with a configurable cache-control setting
  app.all('/counter/:id/cache-control/:cache', function(req, res) {
    var count = icCounts[req.params.id] || 1;
    icCounts[req.params.id] = count + 1;

    res.status(200)
      .set('Cache-Control', req.params.cache)
      .send(count.toString());
  });

  // for each ID - return success response with cache, then fail
  var stfCounts = {};
  app.all('/succeed-then-fail/:id/cache-control/:cache', function(req, res) {
    var count = stfCounts[req.params.id] || 1;
    stfCounts[req.params.id] = count + 1;

    if(count < 2)
      res.status(200)
        .set('Cache-Control', req.params.cache)
        .send('Ok!');
    else
      res.status(500).send("Oh my!");
  });

  // register a route for each HTTP method returning the method that was used in a header (to test HEAD properly)
  app.all('/return-method-used/:method', function(req, res) {
    res.status(200).set('X-Method', req.method).send('');
  });

  // this route returns a 404 once, then 200 to test 4xx caching
  var first404then200Ids = {};
  app.get('/first-404-then-200/:id', function(req, res) {
    if (first404then200Ids[req.params.id]) {
      res.status(200).send('Ok.');
    } else {
      first404then200Ids[req.params.id] = true;
      res.status(404).send('Not found.');
    }
  });

  return app;
}
