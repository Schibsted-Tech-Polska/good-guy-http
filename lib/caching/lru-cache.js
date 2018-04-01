var clone = require('clone');

module.exports = function(maxEntries, Promise) {
  Promise = Promise || global.Promise;

  /**
   * A simple in-memory good guy cache implementation that has a cap on the maximum number of cached entries.
   * If that number is exceeded, least recently used entries are dropped.
   * @param maxEntries the maximum number of entries
   * @constructor
   */
  function LRUCache(maxEntries) {
    this.maxEntries = maxEntries || 500;
    this._entryOrder = [];
    this._entryMap = {};
  }
  LRUCache.prototype = {
    retrieve: function (key) {
      var entry = this._entryMap[key];
      if (entry !== undefined) {
        this._markAsRecent(key);
        return Promise.resolve(clone(entry));
      } else {
        return Promise.resolve(undefined);
      }
    },

    store: function (key, value) {
      value = clone(value);
      var entry = this._entryMap[key];
      if (entry !== undefined) {
        this._entryMap[key] = value;
        this._markAsRecent(key);
      } else {
        this._entryMap[key] = value;
        this._entryOrder.unshift(key);
        if (this._entryOrder.length > this.maxEntries)
          this._discardLeastRecentlyUsed();
      }

      return Promise.resolve();
    },

    evict: function (key) {
      delete this._entryMap[key];
      return Promise.resolve();
    },

    _markAsRecent: function (key) {
      var index = this._entryOrder.indexOf(key);
      if (index >= 0) {
        this._entryOrder.splice(index, 1);
        this._entryOrder.unshift(key);
      }
    },

    _discardLeastRecentlyUsed: function () {
      var key = this._entryOrder.pop();
      delete this._entryMap[key];
    }
  };

  return new LRUCache(maxEntries);
};


