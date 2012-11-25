
var ViewModel = require('./viewModel');
var Photo = require('../models/photo');
var _ = require('underscore');
var async = require('async');

module.exports = function(app){

  var dropboxConnector = require('../connectors/dropbox')(app);
  var instagramConnector = require('../connectors/instagram')(app);
  var flickrConnector = require('../connectors/flickr')(app);

  app.get('/import', function(req, res){

    if (!req.user){
      var model = new ViewModel(req.user);
      model.error = 'You have to login first';
      return res.render('500.ejs', model);
    }

    if (req.user.accounts && req.user.accounts.dropbox){

      dropboxConnector.downloadAllPhotos(req.user, function(err, photos){
        if (err || !photos) {
          throw err;
        }

        Array.prototype.slice.call(photos);

        async.map(photos, function(photo, next){

          Photo.findOne({'source' : photo.source, 'taken' : photo.client_mtime}, function(err, dbPhoto){

            if (err) {
              throw err;
            }

            if (!dbPhoto){
              dbPhoto = new Photo();
            }


            dbPhoto.set('owners', _.uniq(_.union([req.user._id], dbPhoto.owners)));

            dbPhoto.source = photo.source;
            dbPhoto.path = photo.path;
            dbPhoto.modified = photo.modified;
            dbPhoto.taken = photo.client_mtime;
            dbPhoto.interestingness = Math.random() * 100; // dummy value now. TODO: change to real one
            // dbPhoto.interestingness = dbPhoto.interestingness || 50; 
            dbPhoto.metadata = photo;
            dbPhoto.bytes = photo.bytes;
            dbPhoto.mimeType = photo.mime_type;

console.log('save', dbPhoto, photo);

            dbPhoto.save(function(err, savedPhoto){
              return next(err, savedPhoto);
            });
          });
        }, function(err){

          res.redirect('/photos');
        });


      });
    } else{
      throw "No compatible accounts are connected to this user";
    }


  });

};