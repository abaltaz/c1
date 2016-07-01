var express = require('express');
var router = express.Router();
var request = require('request');
var GoogleSpreadsheet = require("google-spreadsheet");
var moment = require('moment');
var underscore = require('underscore');
var parseString = require('xml2js').parseString;
var markdownDeep = require('markdowndeep');
var Promise = require('promise');

var markdown = new markdownDeep.Markdown();
markdown.ExtraMode = true;
markdown.SafeMode = false;

var blogPosts;

getGoogleSheet().then(function(posts){
	blogPosts = posts;
});


function getGoogleSheet() {
	
	return new Promise(function(resolve,reject) {
	
		// spreadsheet key is the long id in the sheets URL 
		var my_sheet = new GoogleSpreadsheet('1kzx2IhUqBEjRm6vx0hGwIMptemtubrZKgjIqhVkZ7ZA');
	
		my_sheet.getRows(1, function(err, row_data){

			var items = [];

			underscore.each(row_data, function(row_json, index) {

				var timestamp = moment(row_json.date, "YYYY-MM-DD").format("MMMM D, YYYY");

				items.push({
					title: row_json.title,
					body: markdown.Transform(row_json.body),
					timestamp: timestamp,
					timeEpoch: timestamp.valueOf(),
					slug: convertToSlug_withDate(row_json.title, moment(row_json.date, "YYYY-MM-DD"))
				});

				resolve(items);

			});
		});
	});
}


function doRequest(endpoint, endpointFormat){
	return new Promise(function(resolve,reject) {
		request(endpoint, function(error, response, body) {
			console.log("Request made to " + endpoint);
			
			if (!error && response.statusCode == 200) {
			
				if (endpointFormat === "json") {
					resolve(JSON.parse(body));
				}
				else if (endpointFormat === "xml") {
					resolve(body);
				}
			}
			
			else {
				resolve(Error);
			}
			
		});
	});
}


function convertToSlug_withDate(Text, Date) {	
	var t = Text.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-');
	var d = Date.format("-MMDDYY");

	return t + d;

}


//Set up routers for blog page and blogpost page

var blogRouter = express.Router();
var blogPostRouter = express.Router();

blogRouter.get('/blog', function(req, res, next) {

	res.render('blog', {
		blogPosts: blogPosts
	});

});


blogPostRouter.get('/blog/:slug', function(req, res, next) {

	var post = underscore.where(blogPosts, {slug: req.params.slug});
	res.render('blogpost', { post:post[0] });

});


module.exports.blogRouter = blogRouter;
module.exports.blogPostRouter = blogPostRouter;

