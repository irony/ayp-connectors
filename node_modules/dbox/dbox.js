var request = require("request")
var oauth   = require("./lib/oauth")
var qs      = require("querystring")


var set_args = function (options, args) {
  for(var attr in args) {
    if (args.hasOwnProperty(attr)){
      options[attr] = args[attr];
    }
  }
  return options;
};

exports.app = function(config){

  var sign = oauth(config.app_key, config.app_secret)
  var root = config.root || "sandbox"
 
  return {

    requesttoken: function(cb){
      var signature = sign({})
      var args = {
        "method": "POST",
        "headers": { "content-type": "application/x-www-form-urlencoded" },
        "url": "https://api.dropbox.com/1/oauth/request_token",
        "body": qs.stringify(signature)
      }
      return request(args, function(e, r, b){
        var obj = qs.parse(b)
        obj.authorize_url = "https://www.dropbox.com/1/oauth/authorize?oauth_token=" + obj.oauth_token
        cb(e ? null : r.statusCode, obj)
      })
    },

    accesstoken: function(options, cb){
      var params = sign(options)
      var args = {
        "method": "POST",
        "headers": { "content-type": "application/x-www-form-urlencoded" },
        "url": "https://api.dropbox.com/1/oauth/access_token",
        "body": qs.stringify(params)
      }
      return request(args, function(e, r, b){
        cb(e ? null : r.statusCode, qs.parse(b))
      })
    },

    // creates client object
    client: function(options){
      var options = options

      return {
        account: function(cb){
          var params = sign(options)
          var args = {
            "method": "POST",
            "headers": { "content-type": "application/x-www-form-urlencoded" },
            "url": "https://api.dropbox.com/1/account/info",
            "body": qs.stringify(params)
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },
        
        delta: function(args, cb){
          var params = sign(options)
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }
          var args = {
            "method": "POST",
            "headers": { "content-type": "application/x-www-form-urlencoded" },
            "url": "https://api.dropbox.com/1/delta",
            "body": qs.stringify(params)
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

        get: function(path, args, cb){
          var params = sign(options)
          
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }

          var args = {
            "method": "GET",
            "url": "https://api-content.dropbox.com/1/files/" + (params.root || root) + "/" + qs.escape(path) + "?" + qs.stringify(params),
            "encoding": null
          }
          return request(args, function(e, r, b) {
            if (e) {
                cb(null, null, null);
            } else {
                var headers = (r.headers['x-dropbox-metadata'] !== undefined) ? JSON.parse(r.headers['x-dropbox-metadata']) : {};
                cb(r.statusCode, b, headers);
            }
          });
        },

        stream: function(path, args) {
          var params = sign(options);
          
          for(var attr in args)(function(attr){
            options[attr] = args[attr]
          })(attr)

          var args = {
            "method": "GET",
            "url": "https://api-content.dropbox.com/1/files/" + (params.root || root) + "/" + qs.escape(path) + "?" + qs.stringify(params),
            "encoding": null
          }

          return request(args);

        },

        put: function(path, body, args, cb){
          var params = sign(options)
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }

          var args = {
            "method": "PUT",
            "headers": { "content-length": body.length },
            "url": "https://api-content.dropbox.com/1/files_put/" + (params.root || root) + "/" + qs.escape(path) + "?" + qs.stringify(params),
            "body": body 
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

        metadata: function(path, args, cb){
          var params = sign(options);
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }
          var args = {
            "method": "GET",
            "url": "https://api.dropbox.com/1/metadata/" + (params.root || root) + "/" + qs.escape(path) + "?" + qs.stringify(params)
          }
          return request(args, function(e, r, b){
            // this is a special case, since the dropbox api returns a
            // 304 response with an empty body when the 'hash' option
            // is provided and there have been no changes since the
            // hash was computed
            if (e) {
                cb(null, null)
            } else {
                cb(r.statusCode, r.statusCode == 304 ? {} : JSON.parse(b))
            }
          })
        },

        //
        // Recursively loads a dropbox folder
        //
        readdir: function (path, callback) {
          var results = [],
          REQUEST_CONCURRENCY_DELAY = 200,
          callbacks = 0,
          self = this;
          //
          // Remark: REQUEST_CONCURRENCY_DELAY represents the millisecond,
          // delay between outgoing requests to dropbox
          //
          function load (path) {
            callbacks++;
            //
            // Give the dropbox API a delay between requests,
            // by wrapping each depth level in a setTimeout delay
            //
            setTimeout(function(){
              self.metadata(path, function (status, reply) {
                //
                // If we have found any contents on this level of the folder
                //
                if (reply.contents) {
                  reply.contents.forEach(function (item) {
                    //
                    // Add the item into our results array
                    //
                    results.push(item.path);
                    //
                    // If we have encountered another folder, we are going to recurse on it
                    //
                    if (item.is_dir) {
                      load(item.path);
                    }
                  });
                }
                callbacks--;
                if (callbacks === 0) {
                  callback(status, results);
                }
              });
            }, REQUEST_CONCURRENCY_DELAY)
          }
          console.log('warn: recursively loading data from dropbox...this may take some time');
          load(path, results);
        },

        revisions: function(path, args, cb){
          var params = sign(options)
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }

          var args = {
            "method": "GET",
            "url": "https://api.dropbox.com/1/revisions/" + (params.root || root) + "/" + qs.escape(path) + "?" + qs.stringify(params)
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

        restore: function(path, rev, args, cb){
          var params = sign(options)
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }

          params["rev"] = rev

          var body = qs.stringify(params)
          var args = {
            "method": "POST",
            "headers": {
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length
            },
            "url": "https://api.dropbox.com/1/restore/" + (params.root || root) + "/" + qs.escape(path), // + "?" + qs.stringify(params)
            "body": qs.stringify(params)
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

        search: function(path, query, args, cb){
          var params = sign(options)
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }

          params["query"] = query

          var body = qs.stringify(params)
          var args = {
            "method": "POST",
            "headers": {
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length 
            },
            "url": "https://api.dropbox.com/1/search/" + (params.root || root) + "/" + qs.escape(path),
            "body": body
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

        shares: function(path, args, cb){
          var params = sign(options)
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }
          var body = qs.stringify(params)
          var args = {
            "method": "POST",
            "headers": {
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length 
            },
            "url": "https://api.dropbox.com/1/shares/" + (params.root || root) + "/" + qs.escape(path), 
            "body": body
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

        media: function(path, args, cb){
          var params = sign(options)
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }
          var body = qs.stringify(params)
          var args = {
            "method": "POST",
            "headers": {
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length 
            },
            "url": "https://api.dropbox.com/1/media/" + (params.root || root) + "/" + qs.escape(path), 
            "body": body
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

        cpref: function(path, args, cb){
          var params = sign(options);
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }
          var args = {
            "method": "GET",
            "url": "https://api.dropbox.com/1/copy_ref/" + (params.root || root) + "/" + qs.escape(path) + "?" + qs.stringify(params)
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

        thumbnails: function(path, args, cb){
          var params = sign(options)
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }

          var args = {
            "method": "GET",
            "url": "https://api-content.dropbox.com/1/thumbnails/" + (params.root || root) + "/" + qs.escape(path) + "?" + qs.stringify(params),
            "encoding": null
          }
          return request(args, function(e, r, b){
            if (e) {
                cb(null, null, null)
            } else {
                var headers = (r.headers['x-dropbox-metadata'] !== undefined) ? JSON.parse(r.headers['x-dropbox-metadata']) : {};
                cb(r.statusCode, b, headers)
            }
          })
        },

        cp: function(from_path, to_path, args, cb){
          var params = sign(options)
          
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }
          
          // check for copy ref
          if(from_path.hasOwnProperty("copy_ref")){
            params['from_copy_ref'] = from_path["copy_ref"]
          }else{
            params['from_path'] = from_path
          }
          
          params["root"] = params.root || root
          params["to_path"] = to_path
          
          // var from_param_key = "from_path";
          // var params = sign(options)
          // if(cb == null){
          //   cb = args
          // }else{
          //   set_args(params, args);
          //   if (params.hasOwnProperty('from_copy_ref')) {
          //     delete params['from_copy_ref'];
          //     from_param_key = 'from_copy_ref';
          //            }
          // }

          var args = {
            "method": "POST",
            "headers": { "content-type": "application/x-www-form-urlencoded" },
            "url": "https://api.dropbox.com/1/fileops/copy",
            "body": qs.stringify(params)
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

        mv: function(from_path, to_path, args, cb){
          var params = sign(options)
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }
          params["root"] = params.root || root
          params["from_path"] = from_path
          params["to_path"] = to_path

          var args = {
            "method": "POST",
            "headers": { "content-type": "application/x-www-form-urlencoded" },
            "url": "https://api.dropbox.com/1/fileops/move",
            "body": qs.stringify(params)
          }

          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

        rm: function(path, args, cb){
          var params = sign(options)
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }
          params["root"] = params["root"] || root
          params["path"] = path
          var args = {
            "method": "POST",
            "headers": { "content-type": "application/x-www-form-urlencoded" },
            "url": "https://api.dropbox.com/1/fileops/delete",
            "body": qs.stringify(params)
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

        mkdir: function(path, args, cb){
          var params = sign(options)
          if(cb == null){
            cb = args
          }else{
            set_args(params, args);
          }
          params["root"] = params.root || root
          params["path"] = path
          var args = {
            "method": "POST",
            "headers": { "content-type": "application/x-www-form-urlencoded" },
            "url": "https://api.dropbox.com/1/fileops/create_folder",
            "body": qs.stringify(params)
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : JSON.parse(b))
          })
        },

	deltaCursor: function (cursor, options) {

	    var cli = this;

	    var nop = function () {};
	    var defaults = {
		add: nop,
		remove: nop,
		reset: nop,
		finished: nop,
		error: nop
	    };

	    for (attr in defaults) {
		if (!(attr in options)) {
		    options[attr] = defaults[attr];
		}
	    }

	    var finished = function () {
		options.finished(cursor);
	    };


	    (function delta_loop () {
		return cli.delta({cursor: cursor}, function (status, delta) {
			if (status !== 200) {
			    return options.error({
				name: 'error',
				message: 'delta returned status ' + status,
				status: status
			    });
			}
			
			cursor = delta.cursor;

			if (delta.reset) {
			    options.reset();
			}
			
			var cb;

			var delta_list = delta.entries;
			delta_list.reverse();

			for (deltaIdx in delta_list) {
			    var path_meta = delta_list[deltaIdx];
			    var path = path_meta[0];
			    var meta = path_meta[1];
			    
			    if (meta) {
				options.add(meta);
			    }
			    else {
				options.remove(path);
			    }
			}

			if (delta.has_more) {
			    return delta_loop();
			}
			else {
			    return finished();
			}
		    });
		})();
	    },
      }
    },

      session: function (creds){
	  var app = this;

	  var client = null;

	  return {
	      linkedClient: function (login_required, with_link, on_err) {

		  if (typeof login_required !== 'function') {
		      login_required = function () {}
		  }
		  if (typeof with_link !== 'function') {
		      with_link = function () {};
		  }
		  if (typeof on_err !== 'function') {
		      on_err = function () {}
		  }

		  var sess = this;

		  var go_client = function () {
		      return with_link(client);
		  };

		  if (client) {
		      return go_client();
		  }

		  var go_new_client = function (accessToken) {
		      client = app.client(accessToken);
		      return go_client();
		  };

		  return creds.getAccessToken(function (err, accessToken) {
		      if (err) {
			  return on_err(err);
		      }
		      if (accessToken) {
			  return go_new_client(accessToken);
		      }
		      else {
			  
			  var go_login = function () {
			      return app.requesttoken(function (status, requestToken) {
				  creds.setRequestToken(requestToken, function (err) {
				      if (err) {
					  return on_err(err);
				      }
				      return login_required(requestToken.authorize_url);
				  });
			      });
			  };

			  creds.getRequestToken(function (err, requestToken) {
			      if (err) {
				  return on_err(err);
			      }
			      if (requestToken) {
				  return app.accesstoken(requestToken, function (status, accessToken) {

				      // is there an error status
				      // which would suggest we
				      // shouldn't just get a new
				      // request token?

				      if (status !== 200) {
					  return go_login();
				      }
				      return creds.setAccessToken(accessToken, function () {
					  go_new_client(accessToken);
				      });
				  });
			      }
			      else {
				  return go_login();
			      }
			  });
		      }
		  });
	      },

	      unlink: function (cb) {
		  client = null;
		  return creds.setAccessToken(null, function (err) {
		      if (err) {
			  return cb('setAccessToken returned ' + err);
		      }
		      creds.setRequestToken(null, function (err) {
			  if (err) {
			      return cb('setRequestToken returned ' + err);
			  }
			  return cb(null);
		      });
		  });
	      }
	  };
      }
  };
}

var Credentials = exports.Credentials = function (data, source) {
    if (!source) {
	source = {};
    }
    if (typeof source.get !== 'function') {
	source.get =  function (key, cb) {
	    return cb('no back store provided for Credentials.', null);
	}
    }
    if (typeof data === 'string') {
	data = JSON.parse(data);
    }

    if (!data || typeof data !== 'object') {
	throw 'bad credential data';
    }

    this.get = function (key, cb) {
	if ((data !== null) && (data.hasOwnProperty(key))) {
	    return cb(null, data[key]);
	}
	else {
	    source.get(key, function (err, val) {
		if (data != null) {
		    data[key] = val;
		}
		return cb(err, val);
	    });
	}
    };

    this.set = function (key, value, cb) {
	if (data !== null) {
	    if (data.hasOwnProperty(key) && value === data[key]) {
		return cb(null);
	    }
	    data[key] = value;
	}

	if (typeof source.set === 'function') {
	    return source.set(key, value, cb);
	}
    };
};

Credentials.prototype.getJSON = function (cb) {
    var that = this;
    that.getRequestToken(function (err, request) {
	console.log('getJSON request', request);
	if (err) {
	    return cb(err);
	}
	else {
	    that.getAccessToken(function (err, access) {
		console.log('getJSON access', access);
		if (err) {
		    return cb(err);
		}
		else {
		    return cb(null, {
			request: request,
			access: access
		    });
		}
	    });
	}
    });
};

Credentials.prototype.getRequestToken = function (cb) {
    this.get('request', cb);
};

Credentials.prototype.setRequestToken = function (token, cb) {
    this.set('request', token, cb);
};


Credentials.prototype.getAccessToken = function (cb) {
    this.get('access', cb);
};

Credentials.prototype.setAccessToken = function (token, cb) {
    this.set('access', token, cb);
};


