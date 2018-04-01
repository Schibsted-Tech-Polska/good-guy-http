var assert = require('assert');
var LRUCache = require('../../lib/caching/lru-cache');

describe('LRUCache', function(){

  it('should be able to store and retrieve elements', function(done) {
    var lru = new LRUCache(2);
    lru.store('hitchhiker', {answer: 42}).then(function() {
      return lru.retrieve('hitchhiker');
    }).then(function(object) {
      assert.deepEqual(object, {answer: 42});
    }).then(done).catch(done);
  });

  it('should be able to evict elements', function(done) {
    var lru = new LRUCache(2);
    lru.store('hitchhiker', {answer: 42}).then(function() {
      return lru.evict('hitchhiker');
    }).then(function() {
      return lru.retrieve('hitchhiker');
    }).then(function(object) {
      assert.equal(object, undefined);
    }).then(done).catch(done);
  });

  it('should store values rather than references to elements', function(done) {
    var lru = new LRUCache(2);
    var original = {answer: 42};
    lru.store('hitchhiker', original).then(function() {
      original.answer = 43;
      return lru.retrieve('hitchhiker');
    }).then(function(object) {
      assert.deepEqual(object, {answer: 42});
    }).then(done).catch(done);
  });

  it('should return values rather than references to elements', function(done) {
    var lru = new LRUCache(2);
    lru.store('hitchhiker', {answer: 42}).then(function() {
      return lru.retrieve('hitchhiker');
    }).then(function(object) {
      object.answer = 43;
      return lru.retrieve('hitchhiker');
    }).then(function(object) {
      assert.deepEqual(object, {answer: 42});
    }).then(done).catch(done);
  });

  it('should throw away oldest element when nothing is retrieved', function(done) {
    var lru = new LRUCache(3);

    // normally, we should wait for promises to resolve - but we know those things are synchronous so we'll
    // spare us some boilerplate
    lru.store('1', 1);
    lru.store('2', 2);
    lru.store('3', 3);
    lru.store('4', 4);

    Promise.all(['1', '2', '3', '4'].map(lru.retrieve.bind(lru))).then(function(values) {
      assert.deepEqual(values, [undefined, 2, 3, 4]);
    }).then(done).catch(done);
  });

  it('should throw away least recently used element when out of space', function(done) {
    var lru = new LRUCache(4);

    // store 4 values
    Promise.all(['1', '2', '3', '4'].map(function(value) {
      lru.store(value, value);
    })).then(function() {
      // request them in reverse order
      return Promise.all(['4', '3', '2', '1'].map(lru.retrieve.bind(lru)));
    }).then(function() {
      // run out of space
      return lru.store('new', 'new');
    }).then(function() {
      // request everything again
      return Promise.all(['1', '2', '3', '4', 'new'].map(lru.retrieve.bind(lru)));
    }).then(function(values) {
      // '4' should be missing
      assert.deepEqual(values, ['1', '2', '3', undefined, 'new']);
    }).then(done).catch(done);
  });

  it('should be able to use custom Promise implementation', function(done) {
    var spyPromise = createSpyPromise();
    var lru = new LRUCache(2, spyPromise);
    lru.store('hitchhiker', {answer: 42}).then(function() {
      return lru.retrieve('hitchhiker');
    }).then(function(object) {
      assert.equal(spyPromise.resolveCallsCount(), 2);
    }).then(done).catch(done);
  });
});

function createSpyPromise() {
  var resolveCallsCount = 0;
  return {
    resolve: function(value) {
      resolveCallsCount += 1;
      return Promise.resolve(value);
    },
    resolveCallsCount: function() {
      return resolveCallsCount;
    }
  };
}
