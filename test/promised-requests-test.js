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
});


