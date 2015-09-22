var urls = require('url');

module.exports = function groupByHost(args) {
  var request = args[0];
  return urls.parse(request.url).host;
};
