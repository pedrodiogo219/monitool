"use strict";

var express      = require('express'),
	compression  = require('compression'),
	cookieParser = require('cookie-parser'),
	session      = require('express-session'),
	path         = require('path'),
	passport     = require('./authentication/passport'),
	config       = require('../config');

var CouchSessionStore = require('connect-couchdb')(session),
	store = new CouchSessionStore({
		name: config.couchdb.sessionBucket,
		host: config.couchdb.host,
		username: config.couchdb.username,
		password: config.couchdb.password
	});


express()
	.disable('x-powered-by')

	.set('view engine', 'jade')
	.set('views', path.join(__dirname, 'views'))

	.use(compression())
	
	.use(function(request, response, next) {
		if (request.url.match(/^\/(glyphicons|fontawesome)/))
			response.setHeader('Cache-Control', 'max-age=31449600,public');
		else
			response.setHeader('Cache-Control', 'max-age=0,public');
		next();
	})

	.use(require('./controllers/static'))

	.use(cookieParser())
	.use(session({ secret: 'cd818da5bcd0d3d9ba5a9a44e49148d2', resave: false, saveUninitialized: false, store: store }))
	.use(passport.initialize())
	.use(passport.session())

	.use('/authentication', require('./controllers/authentication'))
	.use('/resources', require('./controllers/resources'))
	.use('/reporting', require('./controllers/reporting'))
	
	.listen(config.port);

// catch the uncaught errors that weren't wrapped in a domain or try catch statement
// do not use this in modules, but only in applications, as otherwise we could have multiple of these bound
process.on('uncaughtException', function(err) {
	// handle the error safely
	console.log(err.stack)
});

