var ImageHeaders = require('image-headers');
var exifReader = new ImageHeaders();
var firstTick;

module.exports = function(stream, photo, done){
  stream.on('data', function(chunk){
    try{
      if (!exifReader.finished) exifReader.add_bytes(chunk);
    } catch (err){
      console.log('exif error:'.red, err);
    }
    var now = (new Date()).getTime();
    if (!firstTick) firstTick = now;
  });

  stream.on('end', function(){
    exifReader.finish(function(err, headers){
      if (err || !headers) return done(err); // console.debug('ERROR: Could not read EXIF of photo %s', photo.taken, err);
      if (headers.exif_data && headers.exif_data.image) delete headers.exif_data.image;
      if (headers.exif_data && headers.exif_data.thumbnail) delete headers.exif_data.thumbnail;
      return done(err, headers);
    });
  });
  }
