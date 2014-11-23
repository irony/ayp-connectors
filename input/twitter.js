var InputConnector = require('../base/inputConnector');

module.exports = function twitter() {

  var connector = new InputConnector('twitter');

  connector.downloadThumbnail = function(user, photo, done){
    throw new Error('Not implemented');
  };

  connector.downloadOriginal = function(user, photo, done){
    throw new Error('Not implemented');
  };

  connector.importNewPhotos = function(user, options, done){
    throw new Error('Not implemented');
  };

  connector.getClient = function(user){
    throw new Error('Not implemented');
  };
  
  return connector;
};