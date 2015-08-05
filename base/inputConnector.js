var async = require('async');

function InputConnector(name){
  this.name = name;
}

// Used to request special permissions, right now only facebook
InputConnector.prototype.scope = {};

InputConnector.prototype.downloadThumbnail = function(user, photo, done){
  done(new Error('Not implemented'));
};


InputConnector.prototype.downloadOriginal = function(user, photo, done){
  done( new Error('Not implemented'));
};


InputConnector.prototype.importNewPhotos = function(user, options, done){
  throw new Error('Not implemented');
};


InputConnector.prototype.getClient = function(user){
  throw new Error('Not implemented');
};

/**
 * Upload a photo to s3 and returns an updated Photo record
 * @param  {[type]}   folder thumbnail, original or other folder at s3
 * @param  {[type]}   photo  photo db record
 * @param  {[type]}   stream request stream with photo
 * @param  {Function} done   callback after upload is complete, will return err and photo object as parameters
 * @return {[type]}          [description]
 */
InputConnector.prototype.upload = function(folder, photo, stream, done){
  if (!done) throw new Error('Callback is mandatory');
  if (!photo.mimeType) throw new Error('Mimetype is mandatory');
  if (!stream || !stream.pipe) throw new Error('No stream');
  if (!stream.length && !stream.headers) throw new Error('No stream length or headers available');

  photo.filename = ....

  async.parallell({
    s3: function(next){
      require('./streamers/s3Streamer')(stream, photo, next);
    },
    exif: function(next){
      require('./streamers/exifReader')(stream, photo, next);
    }
  }, function(err, result){
    photo.store = photo.store || {};
    photo.store[folder] = photo.store[folder] || {};
    var headers = result.exif.headers;
    if (headers.exif_data) photo.exif = headers.exif_data;
    if (headers.width && headers.height) {
      photo.store = photo.store || {};
      photo.store[folder] = photo.store[folder] || {};
      photo.store[folder].ratio = headers.width / headers.height;
      photo.store[folder].width = headers.width;
      photo.store[folder].height = headers.height;
      if (folder === 'original' || !photo.ratio){
        photo.ratio = photo.store[folder].ratio;
      }
    }

    photo.store[folder].url = result.s3.url;
    photo.store[folder].stored = new Date();
    photo.markModified('store');

    done(err, photo);
  });
};

module.exports = InputConnector;
