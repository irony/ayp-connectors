// Main app configuration
// ======================
// Initializes database, all routes and express
 

var config      = require('../conf');
var mongoose    = require('mongoose');
var _           = require('underscore');
var colors      = require('colors');
var http        = require('http');
var express     = require('express');
var util        = require('util');
var passport    = require('./auth/passport');
var knox        = require('knox');
var redisStore  = require('connect-redis')(express)();
var SocketIo    = require('socket.io');
var passportsio = require("passport.socketio");
var app         = express.createServer();
var io          = require('socket.io');
var sio         = io.listen(app, { log:false });

mongoose.connection.on("open", function(ref) {
  return console.debug("Connected to mongo server!".green);
});

mongoose.connection.on("error", function(err) {
  console.debug("Could not connect to mongo server!".yellow);
  return console.log(err.message.red);
});

try {
  mongoose.connect(config.mongoUrl);
  console.debug("Started connection on " + config.mongoUrl.split('@')[1].cyan + ", waiting for it to open...".grey);
} catch (err) {
  console.log(("Setting up failed to connect to " + config.mongoUrl).red, err.message);
}

// store the s3 client and socket io globally so we can use them from both jobs and routes without passing it as parameters
global.s3 = knox.createClient(config.aws);
app.io = sio;


exports.init = function() {
  

    // configure Express
    app.configure(function() {
      app.set('views', __dirname + '/views');
      app.set('view engine', 'ejs');
      // app.use(express.logger());
      app.use(express.cookieParser());
      app.use(express.bodyParser());
      app.use(express.methodOverride());
    
      //sio.set("authorization", passportsio.authorize( { secret:config.sessionSecret, store:redisStore }));

      app.use(express.session({ secret: config.sessionSecret, store: redisStore }));
      app.use(passport.initialize());
      app.use(passport.session());
      app.use(express.static(__dirname + '/../client'));
      app.use(app.router);
    });

    app.configure('development', function(){
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
        global.debug = true;
        console.debug = console.log;
        // app.use(express.logger({ format: ':method :url' }));
    });

    app.configure('production', function(){
        app.use(express.errorHandler());
        console.debug = function(){};
    });

    // Error handler
    app.error(function(err, req, res, next){
        res.render('500.ejs', { locals: { error: err },status: 500 });
    });

    require('./routes/user')(app);
    require('./routes/connectors')(app);
    require('./routes/share')(app);
    require('./routes/photos')(app);
    require('./routes/import')(app);
    require('./routes/index')(app);
    require('./sockets/photos')(app);

    // Api methods
    require('./api/photos')(app);


    /* The 404 Route (ALWAYS Keep this as the last route) */
    require('./routes/404')(app);


    return app;
}