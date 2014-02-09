var passport = require('passport');
var InputConnector = require('../inputConnector');

module.exports = function flickr(){

  var connector = new InputConnector('flickr');

  return connector;

};
