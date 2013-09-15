module.exports = {
  inputConnector : require('./inputConnector'),
  importer : require('./importer'),
  connectors : require('require-dir')('./connectors')
}