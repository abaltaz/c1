var express = require('express');
var router = express.Router();
var request = require('request');
var moment = require('moment');
var underscore = require('underscore');
var parseString = require('xml2js').parseString;
var Converter = require("csvtojson").Converter;
var EventEmitter = require('events');
var Promise = require('promise');



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

var gameCalendars = {
	cubs: "http://mlb.mlb.com/ticketing-client/csv/EventTicketPromotionPrice.tiksrv?team_id=112&home_team_id=112&display_in=singlegame&ticket_category=Tickets&site_section=Default&sub_category=Default&leave_empty_games=true&event_type=T&event_type=Y",
	sox:  "http://mlb.mlb.com/ticketing-client/csv/EventTicketPromotionPrice.tiksrv?team_id=145&home_team_id=145&display_in=singlegame&ticket_category=Tickets&site_section=Default&sub_category=Default&leave_empty_games=true&event_type=T&event_type=Y"
};



function getSchedule(endpoint) {
	
	var converter = new Converter({});

	return new Promise(function(resolve,reject){

		require("request").get(endpoint).pipe(converter);

		converter.on("end_parsed", function (schedule) {
			resolve(schedule); //here is your result json object 
		});

	});
}



module.exports.getcubs = new EventEmitter();
module.exports.getsox = new EventEmitter();

function getScheduleInterval(endpoint, team) {

	//Call function to get schedule for given team, export it and emit event when it's ready
	getSchedule(endpoint).then(function(schedule){
		module.exports[team] = schedule;
		module.exports["get" + team].emit('ready');
	});

	//Do it every day
	setTimeout(function() {
		getScheduleInterval(endpoint, team);
	}, 86400000);
}


getScheduleInterval(gameCalendars.cubs, "cubs");
getScheduleInterval(gameCalendars.sox, "sox");




