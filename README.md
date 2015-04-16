# good-guy-http

[![Build Status](https://travis-ci.org/Schibsted-Tech-Polska/good-guy-http.svg?branch=master)](https://travis-ci.org/Schibsted-Tech-Polska/good-guy-http)

Good guy HTTP is an HTTP client library based on the [request][request] module, adding the following stuff on top:

* easy promise-based interface
* caching GET and other idempotent requests, either in-memory or using your chosen cache
  * this automatically obeys 'Cache-control' headers, but you can provide defaults for when it's missing
* retrying failed requests
* collapsing identical requests made at the same time into one
* reporting HTTP error statuses as errors (promise rejections)
* sane but strict defaults regarding timeouts etc.
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
  errorLogger: console.error,        // error logging function - a failing cache doesn't break requests, but logs here
                                     // instead
  
  defaultCaching: {                  // default caching settings for responses without Cache-Control                   
    cached: true, 
    timeToLive: 5000, 
    mustRevalidate: false 
  }  
});
```

You can also pass options to the `request` module through this configuration object. Any options good guy doesn't
recognize will be used to configure the underlying `request` object:

```javascript
var goodGuy = require('good-guy-http')({
  timeout: 100 // that's request's timeout option
});
```

### The goodguy interface

Mirrors what `request` does almost exactly. Any object that the `request` module can handle can also be passed to `good-guy-http`. 
All options will be passed onto request. The `get`, `post`, etc. convenience methods are also present.

All functions support both a promise-based interface (when no callback is passed) and a traditional callback-based one
(when a callback function *is* passed as the second parameter).

### Caches

Any object that has these methods can be used as a cache:

* `store(key, object)` - returning a promise that resolves when the object is stored
* `retrieve(key)` - returning a promise that resolves with the previously stored object, or undefined if no object is found

By default, an in-memory cache limited to the 500 most recently used requests is used, but you can easily override this:

```javascript
var goodGuyLib = require('good-guy-http'); 

var goodGuy = goodGuyLib({cache: goodGuyLib.inMemoryCache(10)});  // smaller in-memory cache
var goodGuy = goodGuyLib({cache: false});                         // disable caching altogether
var goodGuy = goodGuyLib({cache: customCache});                   // your custom implementation based on Redis/Mongo/Bitcoin blockchain
```

[request]: https://github.com/request/request



 
