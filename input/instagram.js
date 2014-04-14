var passport = require('passport');
var InputConnector = require('../base/inputConnector');

module.exports = function instagram() {

  var connector = new InputConnector('instagram');
  return connector;

};
