var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var Converter = require("csvtojson").Converter;
var EventEmitter = require('events');
var c1functions = require('../core/functions');


var cubsParams = {
  name: "Cubs",
  schedule: "http://mlb.mlb.com/ticketing-client/csv/EventTicketPromotionPrice.tiksrv?team_id=112&home_team_id=112&display_in=singlegame&ticket_category=Tickets&site_section=Default&sub_category=Default&leave_empty_games=true&event_type=T&event_type=Y",
  dateFormat: "MM/YY/DD",
  dateIdentifier: "START DATE",
  timeIdentifier: "START TIME"
};

var soxParams = {
  name: "Sox",
  schedule: "http://mlb.mlb.com/ticketing-client/csv/EventTicketPromotionPrice.tiksrv?team_id=145&home_team_id=145&display_in=singlegame&ticket_category=Tickets&site_section=Default&sub_category=Default&leave_empty_games=true&event_type=T&event_type=Y",
  dateFormat: "MM/YY/DD",
  dateIdentifier: "START DATE",
  timeIdentifier: "START TIME"
};


getScheduleInterval(cubsParams, "cubs");
getScheduleInterval(soxParams, "sox");


module.exports.getcubs = new EventEmitter();
module.exports.getsox = new EventEmitter();


function getScheduleInterval(teamParams, teamName) {

	getGameStatus(teamParams).then(function(data){

		module.exports[teamName] = data;
		module.exports["get" + teamName].emit('ready');
	});

	//Do it every day
	setTimeout(function() {
		getScheduleInterval(teamParams, teamName);
	}, 86400000);
}


function getSchedule(endpoint) {
	
	var converter = new Converter({});

	return new Promise(function(resolve,reject){

		require("request").get(endpoint).pipe(converter);

		converter.on("end_parsed", function (schedule) {
			resolve(schedule); //here is your result json object 
		});

	});
}


function getGameStatus(teamParams) {
	return new Promise(function(resolve,reject) {
		getSchedule(teamParams.schedule).then(function(data){
        
	        //Set the current day
	        var today = moment();
	        //("05/29/16 3:00pm", "MM/DD/YY h:mma");    
			
			var games = [];
			

	        //Iterate through each game in the schedule
	        underscore.each(data, function(value, index) {    
  
	          //Assemble a game's date and time like so
	          var gameDatePretty = 
	              value[teamParams.dateIdentifier]
	              + " "
	              + value[teamParams.timeIdentifier];

  
  
	          //Create a Moment from the games date and time
	          var gameDate = moment(gameDatePretty, "MM/DD/YY hh:mm A");
			  
			  //Create a Moment 5 hours after a game's start time
			  var gameEnd = gameDate.clone().add(3, "hours");
 
			  
			  var status = c1functions.determineEventStatus(gameDate, gameEnd, 3);

			  
			  if (status && status.inDisplayWindow == true) {

				var game = {
			  		inDisplayWindow: status.inDisplayWindow,
					status: status.type,
					statusRank: c1functions.statusOrder.indexOf(status.type),
					start: gameDate,
					end: gameEnd,
					title: `${teamParams.name} game in Chicago ${gameDate.format("(MM/DD)")}`,
					slug: c1functions.convertToSlug_withDate(teamParams.name, gameDate)
				};

				game["classNames"] = "game " + teamParams.name.toLowerCase() + " " + game.slug;
				
				if (status.type === "soon" || status.type === "later") {
					game["description"] = "Starts at " + gameDate.format("h:mm A");
				}

				else if (status.type === "current") {
					game["description"] = "Started at " + gameDate.format("h:mm A");
				}
				
				else if (status.type === "recent") {
					game["description"] = "Started at " + gameDate.format("h:mm A");
				}
				
				else if (status.type === "future") {
					game["title"] = teamParams.name + " at home, starts at " + gameDate.format("h:mm A (MM/DD)");
				}
				  
				games.push(game);
				
			  }

	        });

	        resolve(games);
		});
	});
}

