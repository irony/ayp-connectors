var passport = require('passport');
var InputConnector = require('../inputConnector');

module.exports = function (config) {

  var connector = new InputConnector('instagram');
  return connector;

};
