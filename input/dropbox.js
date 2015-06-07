var dbox = require('dbox');
var InputConnector = require('../base/inputConnector');
var models = require('ayp-models');
var User = models.user;
var nconf = require('nconf');
var request = require('request');

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

      req.on('error', function(err) {
        console.debug('error download thumbnail %s', err);
        req.abort();
      });

      req.on('response', function(res) {
        if (!res || res.statusCode > 200) {
          if (+res.statusCode === 503){
            var retryAfter = res.headers && res.headers['Retry-After'] * 1000 || 5000;
            return done({ err: res.statusCode, retryAfter: retryAfter });
          } else {
            return done('Error downloading thumbnail (' + res.statusCode + ', details: ' + res.body + ')');
          }
        }

        connector.upload('thumbnail', photo, res, function(err, photo) {
          console.debug('done');
          return done(err, photo);
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
      // don't download movieclips yet
      return done(null, null);
    }

    var client = this.getClient(user);

    var req = client.stream(photo.path);
    req.timeout = 100000;

    req.on('error', function(err) {
      console.debug('error download original %s', err);
      req.abort();
    });


    req.on('response', function(res) {
      //res.length = photo.bytes;

      if (!res || res.statusCode > 200) {
        console.debug('error original code:%s user:%s path:%s', res.statusCode, user.displayName, photo.path);
        var retryAfter = res.headers && res.headers['Retry-After'] * 1000 || 5000;
        return done({ err: res.statusCode, retryAfter: retryAfter });
      }

      connector.upload('original', photo, res, function(err, photo) {
        done(err, photo);
      });
    });
  };

  connector.getOriginalUrl = function(user, photo, done) {
    var client = this.getClient(user);
    client.media(photo.path, done);
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

  connector.wait = function(user, done){
    if (!user.accounts || !user.accounts.dropbox.cursor) return done(null, true, 'dropbox');
    request.get({
      url:'https://api-notify.dropbox.com/1/longpoll_delta',
      timeout: (480+90)*1000, // max timeout plus jitter
      json: true,
      qs:{
        cursor: user.accounts.dropbox.cursor,
        timeout: 480
      }
    }, function(err, response, body){
      if (err) return done(err);
      console.debug('wait response from dropbox', body);
      if(body.changes) return done(null, true);
      setTimeout(function(){
        // start new request until we find changes
        connector.wait(user, done);
      }, (body.backoff || 5) * 1000);
    });
  };

  var convertReplyToPhotos = function (reply){

    var photos = (reply.entries ||  []).map(function(photoRow) {

    var photo = photoRow[1];
    if (!photo) return null;
    photo.mimeType = photo && photo.mime_type;
    photo.taken = photo && photo.client_mtime;
    photo.source = 'dropbox';
    var req = client.thumbnails(photo.path, {size: 'l'}, function(){});
    photo.store = {preview: {url : req.uri.href}};
    req.abort(); // HACK: do this without sending the request instead - look for oauth lib
    return photo && photo.mime_type && photo.bytes > 100 * 1024 && photo.bytes < 10 * 1024 * 1024 && ['image', 'video'].indexOf(photo.mime_type.split('/')[0]) >= 0 ? photo : null;

  }).filter(function(a) { return a; });
  }

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
        console.debug('loading delta #' + cursor + ' for user ' + user.displayName);
        client.delta({
          cursor: cursor || null
        }, function(status, reply) {
          console.debug('got response status #' + status, reply);

          if (status !== 200 || !reply) {
            // hit request limit, try again
            if (+status === 503){
              var retryAfter = reply.headers && reply.headers['Retry-After'] * 1000 || 5000;
              return done({err: status, retryAfter:retryAfter});
            } else {
              return done && done(status);
            }
          }

          var photos = (reply.entries || []).map(function(photoRow) {

            var photo = photoRow[1];
            if (!photo) return null;
            photo.mimeType = photo && photo.mime_type;
            photo.taken = photo && photo.client_mtime;
            photo.source = 'dropbox';
            var req = client.thumbnails(photo.path, {size: 'l'}, function(){});
            photo.store = {preview: {url : req.uri.href}};
            req.abort(); // HACK: do this without sending the request instead - look for oauth lib
            return photo && photo.mime_type && photo.bytes > 100 * 1024 && photo.bytes < 10 * 1024 * 1024 && ['image', 'video'].indexOf(photo.mime_type.split('/')[0]) >= 0 ? photo : null;

          }).filter(function(a) { return a; });

          console.debug('found %d photos from %d entries', photos.length, reply.entries.length);
          user.accounts.dropbox.cursor = reply.cursor;
          user.markModified('accounts');
          user.save();

          photos.next = reply.has_more && reply.cursor || undefined;
          return done && done(err, photos);

        });

      };

      return loadDelta(options.next || user.accounts.dropbox.cursor);
    });

  };
  return connector;
}

module.exports = dropboxJob;