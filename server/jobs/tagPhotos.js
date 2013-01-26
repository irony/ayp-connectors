var ObjectId = require('mongoose').Types.ObjectId,
    timeago = require('timeago'),
    Photo = require('../models/photo'),
    async = require('async'),
    mongoose = require('mongoose'),
    emit = {};



module.exports = function(){

  var map = function(){

    var parts = (this.path || '').split('/');
    parts.pop(); // remove filename
    parts.splice(1,1); // remove /photos or main catalog, it's not that interesting
    if (parts.length)
    {
      var self = this;
        parts.forEach(function(tag){
          if (tag.trim()){
            self.owners.map(function(user){
              emit(self._id, tag.trim().split('_').join(' '));
            });

          }
        });
    }
  };

  var reduce = function(photoId, tags){

    return tags.join(',');

  };

  console.log('Starting map/reduce tags...');

  // add query to only reduce modified images
  Photo.mapReduce({map:map, reduce:reduce, out : {replace : 'tags'}, verbose:true}, function(err, model, stats){
  

    if (err) throw err;

    model.find(function(err, photos){
      console.log('Done with tags map/reduce. Updating %d photos', photos.length, stats);
      photos.forEach(function(photo){
        var updated = {tags : (photo.value || '').split(',')};
        Photo.update({_id : photo._id}, updated, function(err, count){
          if (err) return console.log('error when updating tags:', err);
          if (!photo) return console.log("didn't find photo to update");
        });
      });

    });
  });


};