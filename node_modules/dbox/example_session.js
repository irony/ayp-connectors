
var dbox = require('./dbox');
var tf = require("./textFile");

(function example () {
    // Create a credentials facade, 
    var creds = new tf.Credentials();

    var example_use = function (cli) {
	// When logged in to dropbox, session.linkedClient will call this
	// function with a linked client.
	console.log('Files in dropbox:');
	return cli.metadata('/', function (err, meta) {
	    for (idx in meta.contents) {
		console.log(meta.contents[idx].path);
	    }
	});
    };

    var login_required = function (login_url) {
	// When *not* logged in, session.link will call this function
	// with the login url.
	console.log('Please log in by visiting ' + login_url);
    };

    var onErr = function (err) {
	console.log('Session link returned err: ', err);
    };


    // Create a context in which we have a linked client.
    dbox.app(require('./config').dropbox).session(creds).linkedClient(login_required, example_use, onErr);

})();

