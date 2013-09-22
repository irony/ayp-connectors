var passport = require('passport');
var InputConnector = require('../inputConnector');

module.exports = function twitter(config) {

  var connector = new InputConnector('twitter');

  connector.downloadThumbnail = function(user, photo, done){
    throw new Error('Not implemented');
  };

  connector.downloadOriginal = function(user, photo, done){
    throw new Error('Not implemented');
  };

  connector.importNewPhotos = function(user, done){
    throw new Error('Not implemented');
  };

  connector.getClient = function(user){
    throw new Error('Not implemented');
  };
  
  return connector;
};