var express = require('express');
var compression = require('compression');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var minifyHTML = require('express-minify-html');

//Check if we're using the local environment; if so, load the env file
if (process.env.NODE_ENV === "local") {
  var env = require('./env.js')
}

var routes = require('./routes/');
//var users = require('./routes/users');
var getData = require('./routes/data-get');
var getPast = require('./routes/getPast');
var blog = require('./routes/blog');



//var mlbSchedule = require('./routes/mlbSchedule');

var app = express();


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

//Set cache-control headers to the /public directory with a max-age of 1 day
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 86400000 }));


// compress all requests
//app.use(compression());

if (process.env.NODE_ENV !== "local") {
  app.use(minifyHTML({
      override:      true,
      htmlMinifier: {
          removeComments:            true,
          collapseWhitespace:        true,
          collapseBooleanAttributes: true,
          removeAttributeQuotes:     true,
          removeEmptyAttributes:     true,
          minifyJS:                  true
      }
  }));
}


app.use('/', getData);

//router for /blog
app.use('/', blog.blogRouter);
  
//router for /blog/:slug
app.use('/', blog.blogPostRouter);

//app.use('/date/:year/:month/:day/:time', getPast);

app.use('/', getPast);

/*
app.get('/date/:year/:date', function(req,res,next){
  console.log("hi",req.params);
  next();
});
*/

//app.use('/users', users);



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});



module.exports = app;
