var express = require('express');
var router = express.Router();
var c1functions = require('../core/functions');

console.log("getPast.js");


router.get('/time/:date/:time', function(req,res,next){
	console.log("yo", req.params);
	
	c1functions.firebaseGet(req.params.date, req.params.time).then(function(data) {

		console.log("EY", data);

		if (data) {
			console.log('ehm', data);
			res.render('time', {data:data});
		}

		else {
			console.log("404?");
			next();
		}

	});
});

module.exports = router;