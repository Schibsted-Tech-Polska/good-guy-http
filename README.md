# good-guy-http

[![Build Status](https://travis-ci.org/Schibsted-Tech-Polska/good-guy-http.svg?branch=master)](https://travis-ci.org/Schibsted-Tech-Polska/good-guy-http) [![Coverage Status](https://coveralls.io/repos/Schibsted-Tech-Polska/good-guy-http/badge.svg?branch=master)](https://coveralls.io/r/Schibsted-Tech-Polska/good-guy-http?branch=master) [![Dependency status](https://david-dm.org/Schibsted-Tech-Polska/good-guy-http.svg)](https://david-dm.org/Schibsted-Tech-Polska/good-guy-http)

Good guy HTTP is an HTTP client library based on the [request][request] module, adding the following stuff on top:

* easy promise-based interface
* caching GET and other idempotent requests, either in-memory or using your chosen cache
  * this automatically obeys 'Cache-control' headers, but you can provide defaults for when it's missing
* retrying failed requests
* collapsing identical requests made at the same time into one
* reporting HTTP error statuses as errors (promise rejections)
* sane but strict defaults regarding timeouts etc.
* implementation of the [circuit breaker][circuitbreaker] pattern
* optional postprocessing of response to cache expensive parsing/munging operations
* supports everything request supports by passing all the options to it

![Good Guy HTTP](http://i.imgur.com/m7trEtL.jpg)

All of this is optional and you can opt-out of some or all of it.

## Usage

```javascript
var goodGuy = require('good-guy-http')();

// this request will get its response cached, will be retried if it fails, will be collapsed if you
// happen to make two of them
goodGuy('http://news.ycombinator.com').then(function(response) {
  console.log(response.body);
});
```

That's the basics. If you want to change the default behaviour, pass a configuration object:

```javascript
// all of these are optional, the defaults are listed below
var goodGuy = require('good-guy-http')({
  maxRetries: 2,                     // how many times to retry failed requests
  collapseIdenticalRequests: true,   // should an identical request be collapsed into an ongoing one?
  allowServingStale: true,           // should goodguy return stale cached content after it expires?
                                     // it WILL be updated in the background either way, but if content that's
                                     // a bit stale is acceptable, your requests will appear to be much faster
  cache: ...,                        // cache object - see below for details         
  cacheResponseTimeout: 500          // how many ms to wait for the cache to respond before ignoring it completely
                                     // useful for remote caches (e.g. Redis)
  maxResponseSize: 1024*1024         // any responses above this size will be rejected to prevent memory trouble,                                                                               
                                     // the default is 1MB
  errorLogger: console.error,        // error logging function - a failing cache doesn't break requests, but logs here
                                     // instead
  postprocess: false,                // pass a function here if you want to postprocess the response before caching/
                                     // returning it, e.g. function(res) { return JSON.parse(res.body); }
                                     // useful for ensuring that expensive parsing happens only once
  
  usePromise: Promise,               // Promise constructor to use, you may want to replace native Promise with 
                                     // different implementation, like q or bluebird
  
  defaultCaching: {                  // default caching settings for responses without Cache-Control                   
    cached: true,                    // - whether such responses should be cached at all
    timeToLive: 5000,                // - for how many ms
    mustRevalidate: false            // - is it OK to return a stale response and fetch in the background?
  },
  
  forceCaching: {...},               // uses the same properties as 'defaultCaching', but forces all requests
                                     // to use the settings (existing Cache-Control headers are IGNORED)
  
  clientErrorCaching: {              // how 4xx errors are treated with regards to caching
    cached: true,                    // they are cached by default, but you can opt out
    timeToLive: 60000,
    mustRevalidate: false
  },
  
  circuitBreaking: {                 // circuit breaking - if more than errorThreshold percent of requests fail 
    errorThreshold: 50               // good-guy stops sending them and periodically checks if the situation improves
  },                                 // you can set 'circuitBreaking: false' to turn this off
  
  idempotent: ...                    // request idempotence (boolean). By default it's automatically selected
                                     // depending on request method
});
```

You can also pass options to the `request` module through this configuration object. Any options good guy doesn't
recognize will be used to configure the underlying `request` object:

```javascript
var goodGuy = require('good-guy-http')({
  timeout: 100 // that's request's timeout option
});
```

Good guy objects can also be reconfigured on the fly by adding good guy options to the request:

```javascript
goodGuy({url: 'http://extremely-flaky-server.org', maxRetries: 10}).then(...);
```

### The goodguy interface

Mirrors what `request` does almost exactly. Any object that the `request` module can handle can also be passed to `good-guy-http`. 
All options will be passed onto request. The `get`, `post`, etc. convenience methods are also present.

All functions support both a promise-based interface (when no callback is passed) and a traditional callback-based one
(when a callback function *is* passed as the second parameter).

The response object that you will receive will not be a http.IncomingMessage, since those are difficult to cache. Instead, you will get a plain old object with `statusCode`, `headers`, `body` and `httpVersion` in all the same places they would be in normal responses.

### Caches

Any object that has these methods can be used as a cache:

* `store(key, object)` - returning a promise that resolves when the object is stored
* `retrieve(key)` - returning a promise that resolves with the previously stored object, or undefined if no object is found
* `evict(key)` - returning a promise that resolves when the object is evicted from cache

By default, an in-memory cache limited to the 500 most recently used requests is used, but you can easily override this:

```javascript
var goodGuyLib = require('good-guy-http'); 

var goodGuy = goodGuyLib({cache: goodGuyLib.inMemoryCache(10)});  // smaller in-memory cache
var goodGuy = goodGuyLib({cache: false});                         // disable caching altogether
var goodGuy = goodGuyLib({cache: customCache});                   // your custom implementation based on Redis/Mongo/Bitcoin blockchain
```

#### Cache modules

* [good-guy-cache-redis](https://www.npmjs.com/package/good-guy-cache-redis)
* [good-guy-disk-cache](https://www.npmjs.com/package/good-guy-disk-cache)

Only idempotent requests are cached

#### Idempotence

By default only HEAD, GET and OPTIONS request are treated as idempotent.
That means only requests mentioned above could be cached or retried as they, in short terms, do not modify state
(for full explanation of idempotence follow the [wikipedia description](https://en.wikipedia.org/wiki/Idempotence#Computer_science_meaning) on the topic).

That behaviour could be changed using `idempotent` key in options.
For some services does that are not REST-ish (e.g. RPC) marking request as idempotent is quite useful.
For example this way failed ElasticSearch query will be retried up to 5 times:

```javascript
goodGuy({
    url: 'http://elasticsearch-server.io/_search',
    method: 'POST',
    maxRetries: 5,
    idempotent: true,
    json: true,
    body: {
        query: {
            match_all: {}
        }
    }
})
  .then(...);
```

### Circuit breaker

To avoid overloading external services that are having trouble coping with the load, good-guy-http uses a circuit breaker
(based on Yammer's [circuit-breaker-js][circuitbreakerjs]) by default. Each host is treated as a separate service and 
has a separate circuit breaker.

Once the breaker trips (too many failures), your requests will start failing with a CircuitBrokenError. It can be easily
identified by having the `code` property set to `ECIRCUIT`. Once the situation improves, requests will start going
through normally again.

You can configure the error threshold or turn the whole feature off:

```javascript
var goodGuyLib = require('good-guy-http'); 

var goodGuy = goodGuyLib({
  circuitBreaking: { errorThreshold: 75 } // only break the circuit when 75% or more requests fail
});
var goodGuy = goodGuyLib({circuitBreaking: false}); // no circuit breaking, please
```





[request]: https://github.com/request/request
[circuitbreaker]: http://martinfowler.com/bliki/CircuitBreaker.html
[circuitbreakerjs]: https://github.com/yammer/circuit-breaker-js
