
var Photo = require('../models/photo');
var User = require('../models/user');
var _ = require('underscore');
var async = require('async');


var importer = {


  savePhotos : function(user, photos, progress){

        async.map(photos, function(photo, next){

          Photo.findOne({'source' : photo.source, 'taken' : photo.client_mtime}, function(err, dbPhoto){

            if (err) {
              throw err;
            }

            if (!dbPhoto){
              dbPhoto = new Photo();
            }


            dbPhoto.set('owners', _.uniq(_.union([user._id], dbPhoto.owners)));

            dbPhoto.source = photo.source;
            dbPhoto.path = photo.path;
            dbPhoto.modified = photo.modified;
            dbPhoto.taken = photo.client_mtime;
            dbPhoto.interestingness = dbPhoto.interestingness || Math.random() * 100; // dummy value now. TODO: change to real one
            // dbPhoto.interestingness = dbPhoto.interestingness || 50;
            dbPhoto.metadata = photo;
            dbPhoto.bytes = photo.bytes;
            dbPhoto.mimeType = photo.mime_type;

            dbPhoto.save(function(err, savedPhoto){
              return progress && progress(err, savedPhoto);
            });

          });
        }, function(err, savedPhotos){

          if (progress) progress(err, savedPhotos);

        });
  },

  downloadPhoto : function(user, photo, done){

    var connector = require('../connectors/' + photo.source);
    if (connector.downloadPhoto) {
      async.parallel({
        download : function(callback){
          connector.downloadPhoto(user, photo, callback);
        },
        thumbnail : function(callback){
          connector.downloadThumbnail(user, photo, callback);
        }
      }, function(err, results){
        done(err, results);
      });
    }

  },


  importPhotosFromAllConnectors : function(user, done){
    if (user.accounts){
      
      _.each(user.accounts, function(account, connectorName){
        console.log('Evaluating', connectorName);

        var connector = require('../connectors/' + connectorName);
        if (connector.downloadAllMetadata) {
            console.log('downloading metadata from', connectorName);

          connector.downloadAllMetadata(user, function(err, photos){
            if (err || !photos) return console.error(err);
            console.log('saving metadata for %d photos', photos.length);
            return importer.savePhotos(user, photos, done);

          });
        }
      });

    }

  },
  fetchNewMetadata : function(){
    User.find().where('accounts.dropbox').exists().exec(function(err, users){
      users.map(function(user){
        importer.importPhotosFromAllConnectors(user);
      });
    });
  },

  fetchNewPhotos : function(autoRestart){

    var photoQuery = Photo.find().where('store.thumbnails.stored').exists(false).sort('-modified').limit(100);
    var downloadAllResults = function downloadAllResults(err, photos){
       console.log('Found %d photos without downloaded images. Downloading...', photos.length);

      async.map(photos, function(photo, done){
        User.find().where('_id').in(photo.owners).exec(function(err, users){
          
          if (!users || !users.length) {
            console.log("Didn't find any user records for any of the user ids:", photo.owners);
            return photo.remove(done);
          }

          users.map(function(user){
            importer.downloadPhoto(user, photo, function(err, result){
              process.stdout.write('.');
              done(null, photo); // ignore errors since we want to continue
              if (err) console.error('\nError importing photo: %s', photo._id, err);
            });
          });
        });
      }, function(err, photos){
        
        console.log('\nImported %d photos', _.compact(photos).length);
  
        if(autoRestart)
          photoQuery.exec(downloadAllResults);
      });
    };
    
    photoQuery.exec(downloadAllResults);

  }

};

module.exports = importer;