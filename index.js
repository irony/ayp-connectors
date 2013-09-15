var _ = require('lodash');

module.exports = function(conf){
  var connectors = require('require-dir')('./connectors');
  var result = {};

  // initialize all connectors and return the result
  _.each(connectors, function(connector){result[connector.name] = connector(conf)});
  return result;
};
