function InputConnector(name){
  this.name = name;
}

var ImageHeaders = require("image-headers");
var Photo = require("AllYourPhotosModels").photo;

// Used to request specieal permissions from example facebook
InputConnector.prototype.scope = {};

InputConnector.prototype.downloadThumbnail = function(user, photo, done){
  done(new Error('Not implemented'));
};


InputConnector.prototype.downloadOriginal = function(user, photo, done){
  done( new Error('Not implemented'));
};


InputConnector.prototype.importNewPhotos = function(user, progress){
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
  if (!done) throw new Error("Callback is mandatory");
  if (!photo.mimeType) throw new Error("Mimetype is mandatory");
  if (!stream || !stream.pipe) throw new Error('No stream');
  if (!stream.length && !stream.headers) throw new Error('No stream length or headers available');

  var self = this;
  var error = null;
  var filename = '/' + folder + '/' + photo.source + '/' + photo._id;
  var headers = {
          'Content-Length': stream.headers && stream.headers['content-length'] || stream.length,
          'Content-Type': photo.mimeType,
          'x-amz-acl': 'public-read',
          'Cache-Control': 'public,max-age=31556926'
      };

  var put = global.s3.putStream(stream, filename, headers, function(err, res){
    if (err) return done(err);

    if (200 === res.statusCode || 307 === res.statusCode) {
      photo.store = photo.store || {};
      photo.store[folder] = photo.store[folder] || {};

      photo.store[folder].url = put.url;
      photo.store[folder].stored = new Date();
      photo.markModified('store');

      return done(error, photo);
    } else {
      res.on('data', function(chunk){
        console.log(chunk.toString().red);
      });
      return done(new Error('Error when saving to S3, code: '.red + res.statusCode, null));
    }
  });

  put.on('error', function(err){
    error = err;
    console.log(bytes);
    console.log('unhandled exception while sending to S3: '.red, err.toString(), filename);
  });

  var exifReader = new ImageHeaders();
  var firstTick;
  var bytes=0;
  stream.on('data', function(chunk){
    try{
      if (!exifReader.finished) exifReader.add_bytes(chunk);
    } catch (err){
      console.log('exif error:'.red, err);
    }
    bytes+=chunk.length;

    var now = (new Date()).getTime();
    if (!firstTick) firstTick = now;
  });

  stream.on('end', function(){
    exifReader.finish(function(err, headers){
      
      if (err || !headers) return; // console.debug('ERROR: Could not read EXIF of photo %s', photo.taken, err);

      if (headers.exif_data && headers.exif_data.image) delete headers.exif_data.image;
      if (headers.exif_data && headers.exif_data.thumbnail) delete headers.exif_data.thumbnail;

      if (headers.exif_data) photo.exif = headers.exif_data;
      if (headers.width && headers.height) {
        photo.store = photo.store || {};
        photo.store[folder] = photo.store[folder] || {};
        photo.store[folder].ratio = headers.width / headers.height;
        photo.store[folder].width = headers.width;
        photo.store[folder].height = headers.height;

        var now = (new Date()).getTime();
        console.debug("Downloaded photo " + photo._id + " size:" + bytes / 1000 + " in " + Math.round(bytes / (now-firstTick)) + " kb/s");

        if (folder === "original" || !photo.ratio){
          photo.ratio = photo.store[folder].ratio;
        }
      }
      //console.debug('EXIF finished of photo', headers, err);
      //return photo.update(setter, {upsert: true, safe:true});
    });
  });

  /*if (stream.pipe){
    console.log('Piping to s3');
    return stream.pipe(req);
  } else {
    return req.end(stream);
  }*/

  /*
  console.log('save', filename)
  var mkdirp = require('mkdirp'),
      fs = require('fs'),
      p = require('path'),
      pathArray = filename.split('/');

  pathArray.pop(); // remove file part

  mkdirp(pathArray.join('/'), function (err) {
    if (err && done) done(err);
  });

  fs.writeFile(filename, data, done);*/
};

module.exports = InputConnector;