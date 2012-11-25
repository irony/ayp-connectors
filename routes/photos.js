var ViewModel = require('./viewModel');
var Photo = require('../models/photo');

module.exports = function(app){


  app.get('/photos', function(req, res){
    var model = new ViewModel(req.user);

    if (!req.user){
      model.error = 'You have to login first';
      return res.render('500.ejs', model);
    }

    res.render('photos.ejs', model);

  });

  app.get('/photos/random/:id', function(req, res){
    if (!req.user){
      return res.redirect('http://lorempixel.com/1723/900/people/' + req.params.id);
    }

    Photo.find({owners: req.user._id})
    .skip(Math.min(req.query.skip || 0))
    .limit(Math.min(req.query.limit || 50))
    .sort('-interstingness')
    .exec(function(err, photos){

      var photo = photos[Math.round(Math.random()*50)];
      if(photo) {
        return res.redirect('http://lorempixel.com/1723/900/people/' + req.params.id);
      }
 
      res.redirect('/img/thumbnails/' + photo.source + '/' + photo._id);

    });
  });

  app.get('/photoFeed', function(req, res){

    var model = new ViewModel(req.user);

    if (!req.user){
      model.error = 'You have to login first';
      return res.render('500.ejs', model);
    }
    console.log(req.query.startDate)

    Photo.find({'owners': req.user._id})
    .where('taken').lte(req.query.startDate || new Date())
    .where('interestingness').gte(100- (req.query.interestingness || 50))
    .skip(req.query.skip || 0)
    .limit(req.query.limit || 100)
    .sort('-taken')
    .exec(function(err, photos){
      console.log('query', req.query);

      (photos || []).map(function(photo){
        photo.metadata = null;
      });

      res.json(photos);
    });
  });

  app.post('/photoRange', function(req, res){

    var startDate = req.body.dateRange.split(' - ')[0],
    stopDate = req.body.dateRange.split(' - ')[1],
    model = new ViewModel(req.user);

    if (!req.user){
      model.error = 'You have to login first';
      return res.render('500.ejs', model);
    }

    if (!req.body.dateRange){
      return res.end();
    }

    Photo.find({'owners': req.user._id})
    .limit(500)
    .where('taken').gte(startDate).lte(stopDate)
    .sort('-taken')
    .exec(function(err, photos){
      photos = (photos||[]).map(function(photo){
        return '/img/thumbnails/' + photo.source + '/' + photo._id;
      });
      res.end(JSON.stringify(photos));
    });
  });


};