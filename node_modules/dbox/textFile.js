
// example credentials facade, using a text file as storage for the
// credentials.

var fs = require('fs');

var inherits = require('util').inherits;
var dbox = require('./dbox');

var defaultTokenFile = exports.defaultTokenFile = 'token_store.json';
var Credentials = exports.Credentials = function (credsFile) {
    if (!credsFile) {
	credsFile = defaultTokenFile;	
    }
    
    try {
	// read old credentials from file if possible.
	fileData = JSON.parse(fs.readFileSync(credsFile));
    }
    catch (e){
	fileData = {};
    }

    dbox.Credentials.call(this, fileData, {
	get: function (key, cb) {
	    if (fileData.hasOwnProperty(key)) {
		cb(null, fileData[key]);
	    }
	    else {
		return cb(null);
	    }
	},

	set: function (key, value, cb) {
	    fileData[key] = value;
	    return fs.writeFile(credsFile, JSON.stringify(fileData), cb);
	}
    });
};

inherits(Credentials, dbox.Credentials);
