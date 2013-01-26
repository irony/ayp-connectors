var mongoose = require('mongoose');
// var conn = mongoose.connect(process.env['MONGOHQ_URL'] || 'mongodb://localhost/allmyphotos');
var conn = mongoose.connect(process.env.MONGOHQ_URL || 'mongodb://R:billion@alex.mongohq.com:10053/app6520692');
var express = require('express');
var config = require('./conf');
var knox      = require('knox');
var amazon_url = 'http://s3.amazonaws.com/' + config.aws.bucket;
var async = require('async');
var http = require('http');
var User = require('./models/user');
var Photo = require('./models/photo');
var importer = require('./jobs/importer');
var _ = require('underscore');

// more logs
require('longjohn');



var jobs = [
  {fn:require('./jobs/groupImages'), interval: 9 * 60 * 1000},
  {fn:require('./jobs/tagPhotos'), interval: 9 * 60 * 1000},
  {fn:require('./jobs/calculateInterestingness'), interval: 10 * 60 * 1000},
  {fn:require('./jobs/updateRank'), interval: 11 * 60 * 1000},
  {fn:require('./jobs/importer').fetchNewMetadata, interval: 1 * 60 * 1000}
  ,{fn:function(){require('./jobs/importer').fetchNewPhotos({
      limit: 10,
      autoRestart : true
    })}, interval: 0}

];

jobs.map(function(job){

  // first run once
  job.fn.call();


  if (job.interval){
    setInterval(function(){

      job.fn.call();

    }, job.interval);
  }
});


http.globalAgent.maxSockets = Infinity;
global.s3 = knox.createClient(config.aws);
