function InputConnector(){
  
}

var ImageHeaders = require("image-headers");
var Photo = require("../../models/photo");

var extractExif = function(data, done){

  if (!done) throw new Error("Callback is mandatory");

  try {

      var headers = new ImageHeaders();
      headers.add_bytes(data.slice(0, headers.MAX_SIZE));
      return headers.finish(function(err, exif){
        done(err, exif);
      });

  } catch (error) {
    return done(error, null);
  }
};

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

InputConnector.prototype.save = function(folder, photo, stream, done){

  if (!done) throw new Error("Callback is mandatory");

  if (!stream) return done(new Error('No stream'));

/*    global.s3.putFile('/' + filename, stream, function(err, stream){
      console.log('done', err, stream);
      if (done) done(err, stream);

    });*/


    var filename = '/' + folder + '/' + photo.source + '/' + photo._id;
    
    var req = global.s3.put(filename, {
            'Content-Length': stream.length,
            'Content-Type': photo.mimeType
        });

    //console.log('saving %s to s3', folder, req);
    req.on('error', function(err) {
      console.debug('Request error when saving to S3: %s', err.toString().red);
    });
    req.on('response', function(res){
      if (200 === res.statusCode || 307 ==res.statusCode) {
        debugger;
        console.debug('Extracting exif...');
        extractExif(stream, function(err, headers){
        
          if (err) console.log('Could not read EXIF of photo %s', photo._id, err);
            
          var setter = {$set : {}};
          setter.$set['store.' + folder] = {url:req.url, width : headers.width, height: headers.height, stored: new Date()};
          if (headers.exif_data) setter.$set.exif = headers.exif_data;
          if (headers.width && headers.height) setter.ratio = headers.width / headers.height;
          
          console.debug('Saving %s to db...', folder);
          return photo.update(setter, {upsert: true, safe:true}, function(err){
            console.debug('Done saving to db...', err);
            return done(err, photo);
          });
        });

      } else {
        return done(new Error('Error when saving to S3, code: ' + res.toString()));
      }
    });

    return req.end(stream);

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