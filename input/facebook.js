var InputConnector = require('../base/inputConnector');

module.exports = function facebook() {

  var connector = new InputConnector('facebook');

  connector.scope = ['user_photos', 'email'];

  connector.downloadThumbnail = function(user, photo, done){
    //throw new Error('Not implemented');
  };

  connector.downloadOriginal = function(user, photo, done){
    //throw new Error('Not implemented');
  };

  connector.importNewPhotos = function(user, options, done){
    return done();
    //throw new Error('Not implemented');
  };

  connector.getClient = function(user){
    //throw new Error('Not implemented');
  };
  
  return connector;
};
