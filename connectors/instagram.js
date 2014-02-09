var passport = require('passport');
var InputConnector = require('../inputConnector');

module.exports = function instagram() {

  var connector = new InputConnector('instagram');
  return connector;

};
