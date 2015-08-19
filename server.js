var fs = require('fs');
var https = require('https');
var express = require('express');
var helmet = require('helmet');
var Moonboots = require('moonboots-express');
var config = require('getconfig');
var templatizer = require('templatizer');
var async = require('async');

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

var app = express();
var bodyParser = require('body-parser')
var compression = require('compression');
var serveStatic = require('serve-static');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(compression());
app.use(serveStatic(__dirname + '/public'));
if (!config.isDev) {
    app.use(helmet.xframe());
}
app.use(helmet.iexss());
app.use(helmet.contentTypeOptions());

var webappManifest = fs.readFileSync('./public/x-manifest.webapp');

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.get('/login', function (req, res) {
    res.render("login", {"config": config.server});
});

app.get('/logout', function (req, res) {
    res.render('logout');
});

app.get('/config.js', function (req, res) {
    res.type('application/javascript');
    res.send("var SERVER_CONFIG = " + JSON.stringify(config.server) + ";");
});

app.get('/sounds/*', function (req, res) {
    console.log(req.baseUrl);
    res.type('audio/wav');
    res.redirect("./public" + req.baseUrl);
});

app.get('/oauth/login', function (req, res) {
    res.redirect('https://apps.andyet.com/oauth/authorize?client_id=' + config.andyetAuth.id + '&response_type=token');
});

app.get('/oauth/callback', function (req, res) {
    res.render('oauthLogin');
});

app.get('/manifest.webapp', function (req, res, next) {
    res.set('Content-Type', 'application/x-web-app-manifest+json');
    res.send(webappManifest);
});

app.use(function handleError(err, req, res, next) {
    var errorResult = {message: 'Something bad happened :('};

    if (config.isDev) {
        if (err instanceof Error) {
            if (err.message) {
                errorResult.message = err.message;
            }

            if (err.stack) {
                errorResult.stack = err.stack;
            }
        }
    }

    res.status(500);
    res.render('error', errorResult);
});

var clientApp = new Moonboots({
    moonboots: {
        main: __dirname + '/clientapp/app.js',
        developmentMode: config.isDev,
        libraries: [
            __dirname + '/clientapp/libraries/jquery.js',
            __dirname + '/clientapp/libraries/ui.js',
            __dirname + '/clientapp/libraries/resampler.js',
            __dirname + '/clientapp/libraries/IndexedDBShim.min.js',
            __dirname + '/clientapp/libraries/sugar-1.2.1-dates.js',
            __dirname + '/clientapp/libraries/jquery.oembed.js',
            __dirname + '/clientapp/libraries/jquery-impromptu.js'
        ],
        browserify: {
            debug: false
        },
        stylesheets: [
            __dirname + '/public/css/client.css',
            __dirname + '/public/css/jquery.oembed.css',
            __dirname + '/public/css/jquery-impromptu.css'
        ],
        beforeBuildJS: function () {
            if (config.isDev) {
                var clientFolder = __dirname + '/clientapp';
                templatizer(clientFolder + '/templates', clientFolder + '/templates.js');
            }
        }
    },
    server: app,
    cachePeriod: 0,
    render: function (req, res) {
        res.render('index');
    }
});

clientApp.on('ready', function () {
    console.log('Client app ready');
    var pkginfo = JSON.parse(fs.readFileSync(__dirname + '/package.json'));

    var manifestTemplate = fs.readFileSync(__dirname + '/clientapp/templates/misc/manifest.cache', 'utf-8');
    var cacheManifest = manifestTemplate
          .replace('#{version}', pkginfo.version + config.isDev ? ' ' + Date.now() : '')
          .replace('#{jsFileName}', clientApp.moonboots.jsFileName())
          .replace('#{cssFileName}', clientApp.moonboots.cssFileName());
    console.log('Cache manifest generated');


    app.get('/manifest.cache', function (req, res, next) {
        res.set('Content-Type', 'text/cache-manifest');
        res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
        res.send(cacheManifest);
    });

    // serves app on every other url
    app.get('*', function (req, res) {
        res.render(clientApp.moonboots.htmlSource());
    });
});

//https.createServer({
//    key: fs.readFileSync(config.http.key),
//    cert: fs.readFileSync(config.http.cert)
//}, app).listen(config.http.port);

app.listen(config.http.port, function () {
    console.log('Kaiwa running at: ' + config.http.baseUrl);
});
