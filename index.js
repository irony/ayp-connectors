var _ = require('lodash');
var nconf = require('nconf');

module.exports = function(){

  return {
    dropbox: require('./connectors/dropbox')(),
    facebook: require('./connectors/facebook')(),
    //flickr: require('./connectors/flickr')(),
    //instagram: require('./connectors/instagram')(),
    //twitter: require('./connectors/twitter')()
  };
};
