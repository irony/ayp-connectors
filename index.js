var _ = require('lodash');
var nconf = require('nconf');

module.exports = function(){

  return {
    dropbox: require('./input/dropbox')(),
    facebook: require('./input/facebook')(),
    base: require('./base/inputConnector'),
    //flickr: require('./connectors/flickr')(),
    //instagram: require('./connectors/instagram')(),
    //twitter: require('./connectors/twitter')()
  };
};
