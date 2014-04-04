var dbox = require('dbox');
var InputConnector = require('../inputConnector');
var models = require('AllYourPhotosModels');
var User = models.user;
var nconf = require('nconf');

function dropboxJob() {
  this.name = 'dropbox';

  var dropbox = dbox.app(nconf.get('dbox'));

  var connector = new InputConnector('dropbox');

  connector.scope = '';

  connector.downloadThumbnail = function(user, photo, done) {

    if (!done) throw new Error('Callback is mandatory');

    if (!photo) return done(new Error('no photo provided'));
    if (!photo.path) done(new Error('Path is not set on photo.'));
    if (!user || !user.accounts || !user.accounts.dropbox) return done(new Error('not a dropbox user')); // 'Not a dropbox user'
    if (photo.owners.indexOf(user._id.toString()) < 0) return done(new Error('owner not found')); // not this users photo

    try {
      var client = this.getClient(user);
      var req = client.thumbnails(photo.path, {
        size: 'l'
      }, function() {});

      var error;
      req.on('error', function(err) {
        error = err;
      });

      req.on('response', function(res) {
        if (!res || res.statusCode >= 400) {
          console.log('owners', photo.owners);
          console.log('error thumbnail'.red, photo.path);
          return done('Error downloading thumbnail (' + res.statusCode + ', details: ' + res.body + ')');
        }

        console.debug('streaming to s3...');

        connector.upload('thumbnail', photo, res, function(err, photo) {
          console.debug('done');
          return done(err || error, photo);
        });
      });

      return req;
    } catch (err) {
      return done(err);
    }
  };

  connector.downloadOriginal = function(user, photo, done) {
    if (!done) throw new Error('Callback is mandatory');

    if (!user || !user.accounts || !user.accounts.dropbox)
      return done(new Error('Not a dropbox user'), null); // not a dropbox user


    if (!photo || photo.bytes > 10 * 1024 * 1024) {
      return done(null, null);
    }

    var client = this.getClient(user);

    var req = client.stream(photo.path);
    req.timeout = 100000;

    var error;

    req.on('error', function(err) {
      error = err;
    });


    req.on('response', function(res) {
      //res.length = photo.bytes;

      if (!res || res.statusCode >= 400) {
        console.log('error original'.red, user, photo.path);
        return done('Error downloading original');
      }

      connector.upload('original', photo, res, function(err, photo) {
        done(err || error, photo);
      });
    });
  };

  connector.getClient = function(user) {

    if (!user || !user.accounts ||  !user.accounts.dropbox)
      return;

    var access_token = {
      'oauth_token_secret': user.accounts.dropbox.tokenSecret,
      'oauth_token': user.accounts.dropbox.token,
    };

    console.debug('auth token ' + JSON.stringify(access_token));

    var client = dropbox.client(access_token);
    return client;
  };

  connector.importNewPhotos = function(user, options, done) {

    if (!done) throw new Error('Callback is mandatory');
    if (!user || !user._id || user.accounts.dropbox === undefined) {
      return done(new Error('Not a valid dropbox user'));
    }

    return User.findById(user._id, function(err, user) {
      console.debug('Finding photos on dropbox');

      if (err || !user ||  !user.accounts || !user.accounts.dropbox) return done(new Error('error finding user or this user don\'t have dropbox'));
      var client = connector.getClient(user);
      if (!client) return done(new Error('No client recieved'));

      console.debug('Created dropbox client');

      var loadDelta = function(cursor) {
        console.debug('loading delta #' + cursor + ' for user ' + user);
        client.delta({
          cursor: cursor || null
        }, function(status, reply) {
          console.debug('got response status #' + status);

          if (status !== 200 || !reply) {
            // hit request limit, try again
            if (status === 503){
              if (reply.error) return done(reply.error);

              console.debug('error 503, waiting...', reply);
              var retryAfter = reply.headers['Retry-After'] * 1000;
              return setTimeout(function(){
                connector.importNewPhotos(user, options, done);
              }, retryAfter);
            }
            return done && done(status);
          }

          var photos = (reply.entries ||  []).map(function(photoRow) {

            var photo = photoRow[1];
            if (!photo) return null;
            photo.mimeType = photo && photo.mime_type;
            photo.taken = photo && photo.client_mtime;
            photo.source = 'dropbox';

            client.media(photo.path, function(status, file){
              photo.store = {original : {src: file.url}};
            });

            return photo && photo.mime_type && photo.bytes > 100 * 1024 && photo.bytes < 10 * 1024 * 1024 && ['image', 'video'].indexOf(photo.mime_type.split('/')[0]) >= 0 ? photo : null;

          }).filter(function(a) { return a; });

          user.accounts.dropbox.cursor = reply.cursor;
          user.markModified('accounts');

          return user.save(function(err) {
            photos.next = reply.cursor;
            return done && done(err, photos);
          });

        });

      };

      return loadDelta(options.next || user.accounts.dropbox.cursor);
    });

  };
  return connector;
}

module.exports = dropboxJob;