var _ = require('lodash');

module.exports = function(config){
  if (!config) config = require('../conf');

  return {
    dropbox: require('./connectors/dropbox')(config),
    //facebook: require('./connectors/facebook')(config),
    //flickr: require('./connectors/flickr')(config),
    //instagram: require('./connectors/instagram')(config),
    //twitter: require('./connectors/twitter')(config)
  };
};
