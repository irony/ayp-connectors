var knox = require('knox');
var nconf = require('nconf');
var s3 = knox.createClient(nconf.get('aws'));

module.exports = function(stream, photo, done){
  var headers = {
    'Content-Length': stream.headers && stream.headers['content-length'] || stream.length,
    'Content-Type': photo.mimeType,
    //'x-amz-acl': 'public-read',
    'Cache-Control': 'private,max-age=31556926'
  };
  var put = s3.putStream(stream, headers, function(err, res){
    if (err) return done(err);

    if (200 === res.statusCode || 307 === res.statusCode) {
      return done(err, put.url);
    } else {
      res.on('data', function(chunk){
        console.debug(chunk.toString().red);
      });
      return done(new Error('Error when saving to S3, code: ' + res.statusCode, null));
    }
  });

  put.on('error', function(err){
    console.debug('unhandled exception while sending to S3: ', err.toString());
  });
  }
