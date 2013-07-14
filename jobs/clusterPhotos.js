// Cluster photos with k-means
// ===


var ObjectId = require('mongoose').Types.ObjectId,
    Photo = require('../models/photo'),
    PhotoCopy = require('../models/photoCopy'),
    Group = require('../models/group'),
    User = require('../models/user'),
    async = require('async'),
    emit = {}, // fool jsLint
    _ = require('lodash'),
    utils = new require('../client/js/utils')(_),
    clusterfck = require('clusterfck'),
    interestingnessCalculator = require('../jobs/interestingnessCalculator'),
    mongoose = require('mongoose');

function Clusterer(done){
  var self = this;

  if (!done) throw new Error("Callback is mandatory");

  // find all users
  User.find().exec(function(err, users){
    
    if (err) throw err;

    async.mapSeries((users || []), function(user, userDone){

      // find all their photos and sort them on interestingness
      Photo.find({'owners': user._id}, 'taken copies.' + user._id + '.calculatedVote copies.' + user._id + '.vote')
      .where('copies.' + user._id + '.cluster').exists(false)
      // .where('copies.' + user._id + '.clusterOrder').exists(false)
      .sort({ taken : -1 })
      .exec(function(err, photos){
        if (err || !photos || !photos.length) return userDone(err);

        var groups = Clusterer.extractGroups(user, photos, 100);
        var savedPhotos = groups.reduce(function(a, group){
          var rankedGroup = Clusterer.rankGroupPhotos(group);
          a.concat(Clusterer.saveGroupPhotos(rankedGroup));
          return a;
        }, []);

        return userDone(null, savedPhotos.length ? user : null);

      });
    }, function(err, users){

        // if (!err) console.debug(': Cluster OK %d users', users.length);
        if (done) done(err, users);

    });
  });
}


Clusterer.extractGroups = function(user, photos, nrClusters){

  if (!photos.length) return [];

  var vectors = photos.map(function(photo){
    
    var vector = [photo.taken.getTime()]; // this is where the magic happens

    var mine = photo.copies[user._id] || photo;

    vector._id = photo._id;
    vector.oldCluster = mine.cluster;
    vector.taken = photo.taken;
    vector.vote = mine.vote;
    vector.clicks = mine.clicks;
    vector.interestingness = interestingnessCalculator(mine) || Math.floor(Math.random()*100);
    return vector;
  });

  var clusters = vectors && clusterfck.kmeans(vectors.filter(function(a){return a}), nrClusters) || [];
  var groups = clusters.map(function(cluster){
    var group = new Group();
    group.user = user;
    group.photos = _.compact(cluster);
    return group;
  });

  return _.compact(groups);
};

Clusterer.rankGroupPhotos = function(group, nrClusters){
    //var subClusters = utils.cluster(group.photos, nrClusters);
    var subClusters = clusterfck.kmeans(group.photos, nrClusters);
    
    subClusters
      .sort(function(a,b){
        return b.length - a.length; // sort the arrays bigger first, more value toeacho we get the smallest clusters first - less risk of double shots from the same cluster
      })
      .map(function(subCluster, subGroup){

        subCluster.sort(function(a,b){
          return b.interestingness - a.interestingness;
        }).map(function(photo, i){
          photo.oldCluster = photo.cluster;
          photo.cluster=group._id + "." + subGroup + "." + i;
          photo.boost = Math.floor(subCluster.length * 5 / (1+i*2)); // first photos of big clusters get boost
          photo.interestingness = Math.floor(photo.boost + Math.max(0, 100 - (i/subCluster.length) * 100));
          // photo.interestingness = Math.floor(photo.boost + (photo.interestingness || 0));
          // || Math.floor(Math.random()*100)); // ) + photo.boost;
          return photo;
        });
        
        // subCluster.forEach(function(photo){console.log(photo._id)})
        return subCluster;

      });
      // console.debug('..done');

      console.log('sub', subClusters.length);
    group.photos = utils.weave(subClusters);
      console.log('sub', group.photos.length);
    return group;
};

Clusterer.saveGroupPhotos = function(group){
  var i = 1;

  if (!group.user) throw "User is not set on group";
  group.photos = group.photos.map(function(photo){
    if (photo.oldCluster && photo.cluster === photo.oldCluster) {
      return null;
    }

    var setter = {$set : {}};
    //var clusterRank = 100 - (i / group.photos.length) * 100;

    setter.$set['copies.' + group.user + '.clusterOrder'] = i;
    setter.$set['copies.' + group.user + '.interestingness'] = photo.interestingness;
    // + clusterRank + (photo.interestingness); // || Math.floor(Math.random()*100)); // ) + photo.boost;
    setter.$set['copies.' + group.user + '.cluster'] = photo.cluster;
    setter.$set['modified'] = new Date();

    i++;
    Photo.update({_id : photo._id}, setter, {upsert: true});
    return photo;

  });

  group.photos = _.compact(group.photos);
  
  if (!group.photos.length) return null;
  return group;

};

module.exports = Clusterer;