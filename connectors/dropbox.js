var dbox  = require("dbox");
var async  = require("async");
var passport = require('passport');
var InputConnector = require('../inputConnector');
var models = require('AllYourPhotosModels');
var Photo = models.photo;
var User = models.user;
var _ = require('lodash');
var ObjectId = require('mongoose').Types.ObjectId;
var stream = require("stream");

function dropboxJob(config){
	this.name = 'dropbox';

	var dropbox   = dbox.app(config.dbox);

	var connector = new InputConnector('dropbox');

		connector.scope = '';

		connector.downloadThumbnail = function(user, photo, done){
		
		  if (!done) throw new Error("Callback is mandatory");
		  if (!photo.path) throw new Error("Path is not set on photo.");

			if (!user || !user.accounts || !user.accounts.dropbox)
				return done(null, null); // 'Not a dropbox user'

			if (photo.owners.indexOf(user._id) < 0)
				return done(null, null); // not this users photo

			if (!photo) {
				return done(null, null);
			}


			var filename = photo.source + '/' + photo._id;

			try {
				var client = this.getClient(user);
				var req = client.thumbnails(photo.path, {size: 'l'}, function(){});

				var error;
				req.on('error', function(err){
					error = err;
				});

				req.on('response', function(res){
					if(!res || res.statusCode >= 400){
						console.log('owners', photo.owners);
						console.log('error thumbnail'.red, photo.path);
						return done("Error downloading thumbnail");
					}

					connector.upload('thumbnail', photo, res, function(err, photo){
						done(err || error, photo);
					});
				});
			} catch(err){
				done(err);
			}

		};


		connector.downloadOriginal = function(user, photo, done){
			if (!done) throw new Error("Callback is mandatory");

			if (!user || !user.accounts || !user.accounts.dropbox)
				return done(new Error('Not a dropbox user'), null); // not a dropbox user


			if (!photo || photo.bytes > 10 * 1024 * 1024) {
				return done(null, null);
			}

			var client = this.getClient(user);

			var req = client.stream(photo.path);
			req.timeout = 100000;

			var error;
			
			req.on('error', function(err){
				error = err;
			});


			req.on('response', function(res){
				//res.length = photo.bytes;
				
				if(!res || res.statusCode >= 400){
					console.log('error original'.red, user, photo.path);
					return done("Error downloading original");
				}

				connector.upload('original', photo, res, function(err, photo){
					done(err || error, photo);
				});
			});


		};


		connector.getClient = function(user){

			if (!user || !user.accounts || !user.accounts.dropbox)
				return;
			
			var access_token = {
				"oauth_token_secret"	:  user.accounts.dropbox.tokenSecret,
				"oauth_token"					:  user.accounts.dropbox.token,
			};

			console.debug('auth token ' + JSON.stringify(access_token));

			var client = dropbox.client(access_token);
			return client;
		};

		connector.importNewPhotos = function(user, done)
		{

		  if (!done) throw new Error("Callback is mandatory");

			if (!user || !user._id || user.accounts.dropbox === undefined){
				return done(new Error('Not a valid dropbox user'));
			}

	    return User.findById(user._id, function(err, user){
				console.debug('Finding photos on dropbox');

				if (err || !user || !user.accounts || !user.accounts.dropbox) return done(new Error('error finding user or this user don\'t have dropbox'));
				
				var client = connector.getClient(user);

				if (!client) return done(new Error('No client recieved'));
				
				console.debug('Created dropbox client');

				var loadDelta = function(cursor){
					console.debug('loading delta #' + cursor);
					client.delta({cursor : cursor || null}, function(status, reply){
						console.log('Received delta', status);

						if (status !== 200 || !reply)
							return done && done(status);

				    var photos = (reply.entries || []).map(function(photoRow){

							var photo = photoRow[1];
							if (!photo) return null;
							photo.mimeType = photo && photo.mime_type;
							photo.taken = photo && photo.client_mtime;
							photo.source = 'dropbox';
							return photo && photo.mime_type && photo.bytes > 4096 && photo.bytes < 10*1024*1024 && ['image', 'video'].indexOf(photo.mime_type.split('/')[0]) >= 0 ? photo : null;
				    
				    }).reduce(function(a,b){

							if (b) {a.push(b)} // remove empty rows
							return a;

				    }, []);

						user.accounts.dropbox.cursor = reply.cursor;
						user.markModified('accounts');
						
						return user.save(function(err, user){
							return done && done(err, photos);
						});

					});
				};

				return loadDelta(user.accounts.dropbox.cursor);
			});

		};
		return connector;
}

module.exports = dropboxJob;