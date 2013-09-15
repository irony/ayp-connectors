var passport = require('passport');
var InputConnector = require('../inputConnector');

module.exports = function instagram(config) {

  var connector = new InputConnector('instagram');
  return connector;

};
