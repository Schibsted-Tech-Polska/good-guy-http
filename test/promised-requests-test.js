var request = require('request');
var express = require('express');
var assert = require('assert');

describe("Promised requests", function() {
  var app = require('./test-app')();
  var req = require('../lib/promised-request')(request.defaults({timeout: 1000}));

  before(function(done) {
    app.startListening().then(done).catch(done);
  });
  after(function(done) {
    app.stopListening().then(done).catch(done);
  });

  it("should return the body on success", function(done) {
    req(app.url("/return-body/hello")).then(function(result) {
      assert.equal(result, "hello");
      done();
    }).catch(done);
  });

  it("should reject on 4xx HTTP status", function(done) {
    req(app.url("/return-status/404")).then(function() {
      done("The promise wasn't rejected.");
    }).catch(function(err) {
      assert.equal(err.message, "HTTP error: status code 404");
      assert.equal(err.status, 404);
      done();
    });
  });

  it("should reject on 5xx HTTP status", function(done) {
    req(app.url("/return-status/500")).then(function() {
      done(new Error("The promise wasn't rejected."));
    }).catch(function(err) {
      assert.equal(err.message, "HTTP error: status code 500");
      assert.equal(err.status, 500);
      done();
    });
  });
});


