// Importer
// ====
// Helper methods for importing metadata for all active connectors

var Photo = require('../models/photo');
var PhotoCopy = require('../models/photoCopy');
var User = require('../models/user');
var _ = require('underscore');
var async = require('async');


var importer = {

  /**
   * Tries to find a photo in the database and return a reference to it or initializes the given photo record with the appropriate values
   * @param  {[type]}   user  [description]
   * @param  {[type]}   photo [description]
   * @param  {Function} done  [description]
   * @return {[type]}         [description]
   */
  
  findOrInitPhoto : function(user, photo, done){
    Photo.find({'taken' : photo.taken}, function(err, photos){

      var dbPhoto = photos.filter(function(existingPhoto){
        // We found a set of photos at the exact same time but before assuming
        // it is the same we want to do some checks to find our own
        var found = _.some(existingPhoto.owners, function(item){return item === user._id}) ||
        existingPhoto.path === photo.path || // or same filename
        photo.bytes > 100000 && existingPhoto.bytes === photo.bytes; // or same file size

        return found;
      }).pop();

      if (!photo.taken) photo.taken = photo.modified;
      // console.debug('found %s', dbPhoto ? "one photo" : "no photos", err);

      if (err) {
        console.log('Error finding photo', err);
        return done(err);
      }

      if (!dbPhoto){
        if (photo._id) {
          dbPhoto = photo;
        } else{
          dbPhoto = new Photo(photo);
        }
      }

      dbPhoto.set('owners', _.uniq(_.union([user._id], dbPhoto.owners)));

      if (!dbPhoto.copies) dbPhoto.copies = {};

      var photoCopy = dbPhoto.copies[user._id];

      if (!photoCopy)
        dbPhoto.copies[user._id] = photoCopy = new PhotoCopy();

      photoCopy.interestingness = photoCopy.interestingness || Math.random() * 100; // dummy value now. TODO: change to real one
      dbPhoto.markModified('copies');
      // dbPhoto.metadata = _.extend(dbPhoto.metadata || {}, photo);

      if (photo.store)
        dbPhoto.store = _.extend(dbPhoto.store || {}, photo.store);

      if (photo.exif)
        dbPhoto.exif = _.extend(dbPhoto.exif || {}, photo.exif);

      dbPhoto.taken = photo.taken;

      if (photo.ratio)
        dbPhoto.ratio = photo.ratio;

      dbPhoto.mimeType = photo.mimeType;
      dbPhoto.bytes = dbPhoto.bytes || photo.bytes;

      return done(null, dbPhoto);
    });

  },

  /**
   * Save an array of photos fetched elsewhere to the database
   * @param  {[type]} user     a mongoose user model
   * @param  {[type]} photos   array of photos
   * @param  {[type]} progress callback which will be called after save of whole collection with (err, photos)
   */
  savePhotos : function(user, photos, done){
    console.debug('Saving %d photos', photos.length);

    async.map(photos, function(photo, next){

      console.debug('Saving photo %s', photo.path, photo.client_mtime, photo.taken, photo.bytes);

      importer.findOrInitPhoto(user, photo, function(err, photo){
        photo.save(next);
      });

    }, done);
  },
  
  /**
   * Downloads and saves metadata for all connectors of the provided user
   * @param  {[type]}   user user
   * @param  {Function} done callback when done
   */
  importPhotosFromAllConnectors : function(user, done){
    if (user.accounts){
      
      _.each(user.accounts, function(account, connectorName){
        if (!connectorName) return done();

        var connector = require('../server/connectors/' + connectorName); //connectorName.replace(/^[a-z]/,''));
        if (connector.importNewPhotos) {
          connector.importNewPhotos(user, function(err, photos){
            if (err || !photos || !photos.length) return done && done(err);

            console.log('Importer: Found %d new photos', photos.length);
            return importer.savePhotos(user, photos, done);

          });
        }
      });

    }

  },

  importAllNewPhotos : function(done){
    if (!done) throw new Error("Callback is mandatory");
    User.find().where('accounts.dropbox').exists().exec(function(err, users){
      
      if (err || !users.length) done(err);

      async.mapSeries(users, function(user, done){
        importer.importPhotosFromAllConnectors(user, done);
      }, done);
    });
  },

};

module.exports = importer;