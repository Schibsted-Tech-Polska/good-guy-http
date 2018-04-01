module.exports = nullCache;

function nullCache(Promise) {
  Promise = Promise || global.Promise;
  return {
    store: function(key, object) { return Promise.resolve(); },
    retrieve: function(key) { return Promise.resolve(undefined); },
    evict: function(key) { return Promise.resolve(); }
  };
}
