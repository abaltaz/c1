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
	console.log("blog4", posts);
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

module.exports.blog = function (req, res) {

	res.render('blog', {
		blogPosts: blogPosts
	});

};

module.exports.blogPost = function (req, res) {


	var post = underscore.where(blogPosts, {slug: req.params.slug});

	console.log(post);

	res.render('blogpost', { post:post[0] });

	/*

	underscore.where(blogPosts, function(req.params.slug) {

		console.log("URL1", req.params.slug, post.title);

		if (post.slug === req.params.slug) {
			res.render('blogpost', { post:post });
		}

		else {
	      res.render('error');
	    }

	});

	*/

};
