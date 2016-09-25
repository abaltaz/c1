var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var Converter = require("csvtojson").Converter;
var EventEmitter = require('events');
var c1functions = require('../core/functions');

var eventType = "game";

var cubsParams = {
  name: "Cubs",
  schedule: "http://mlb.mlb.com/ticketing-client/csv/EventTicketPromotionPrice.tiksrv?team_id=112&home_team_id=112&display_in=singlegame&ticket_category=Tickets&site_section=Default&sub_category=Default&leave_empty_games=true&event_type=T&event_type=Y",
  dateFormat: "MM/YY/DD",
  dateIdentifier: "START DATE",
  timeIdentifier: "START TIME",
  storedSchedule: ""
};

var soxParams = {
  name: "Sox",
  schedule: "http://mlb.mlb.com/ticketing-client/csv/EventTicketPromotionPrice.tiksrv?team_id=145&home_team_id=145&display_in=singlegame&ticket_category=Tickets&site_section=Default&sub_category=Default&leave_empty_games=true&event_type=T&event_type=Y",
  dateFormat: "MM/YY/DD",
  dateIdentifier: "START DATE",
  timeIdentifier: "START TIME",
  storedSchedule: ""
};


//Download game schedules once per day
getScheduleInterval(cubsParams, "cubs");
getScheduleInterval(soxParams, "sox");

//Process game schedules once per minute
setTimeout(function() {
	getGameStatusInterval(cubsParams, "cubs");
	getGameStatusInterval(soxParams, "sox");
}, 2000);


//module.exports.getcubs = new EventEmitter();
//module.exports.getsox = new EventEmitter();

//Functions to download game schedules once per day
function getScheduleInterval(teamParams) {

	getSchedule(teamParams.schedule).then(function(data){
		teamParams.storedSchedule = data;
		//Do it every day
		setTimeout(function() {
			getScheduleInterval(teamParams);
		}, 86400000);
	}).catch(function(err) {
		setTimeout(function() {
			getScheduleInterval(teamParams);
			console.log("MLB Getting CSV Schedule error: Executing function again in 1 hours");
		}, 3600000);
	});
	
}

function getSchedule(endpoint) {
	
	var converter = new Converter({});

	return new Promise(function(resolve,reject){

		require("request").get(endpoint).pipe(converter);

		console.log(`Request made to MLB ${moment().format("hh:mm:ss")}`);

		converter.on("end_parsed", function (schedule) {
			resolve(schedule); //here is your result json object 
		});

	});
}

/* --------------------- */

//Functions to parse and process game schedules ~once per minute
function getGameStatusInterval(teamParams, teamName) {
	getGameStatus(teamParams).then(function(data){
		module.exports[teamName] = data;
		
		setTimeout(function() {
			getGameStatusInterval(teamParams, teamName);
		}, 60000);
	
	}).catch(function(err) {
		setTimeout(function() {
			getGameStatusInterval(teamParams, teamName);
			console.log("MLB Process Schedule error: Executing function again in 60 seconds");
		}, 60000);
	});

	
}


function getGameStatus(teamParams) {

	console.log("getGameStatus()");

	return new Promise(function(resolve,reject) {
        
        //Set the current day
        var today = moment();
        //("05/29/16 3:00pm", "MM/DD/YY h:mm a");
		
		var games = [];

        //Iterate through each game in the schedule
        underscore.each(teamParams.storedSchedule, function(value, index) {    

          //Assemble a game's date and time like so
          var gameDatePretty = 
              value[teamParams.dateIdentifier]
              + " "
              + value[teamParams.timeIdentifier];



          //Create a Moment from the games date and time
          var gameDate = moment(gameDatePretty, "MM/DD/YY hh:mm a");
		  
		  //Create a Moment 5 hours after a game's start time
		  var gameEnd = gameDate.clone().add(3, "hours");

		  
		  var status = c1functions.determineEventStatus(gameDate, gameEnd, 3);
		  //console.log("MLB Game Status", teamParams.name, gameDatePretty, status);

		  
		  if (status && status.inDisplayWindow == true) {

			var game = {
		  		eventType: eventType,
		  		inDisplayWindow: status.inDisplayWindow,
				status: status.type,
				statusRank: c1functions.statusOrder.indexOf(status.type),
				eventRank: c1functions.eventOrder.indexOf(eventType),
				start: gameDate,
				end: gameEnd,
				title: `${teamParams.name} game in Chicago`,
				slug: c1functions.convertToSlug_withDate(teamParams.name, gameDate)
			};

			game["classNames"] = `${eventType} ${teamParams.name.toLowerCase()} ${game.slug}`;
			
			if (status.type === "later") {
				game["description"] = "Starts at " + gameDate.format("h:mm a");
			}

			else if (status.type === "soon") {
				game["description"] = "Starts " + moment().to(gameDate);
			}

			else if (status.type === "current") {
				game["description"] = "Started at " + gameDate.format("h:mm a");
			}
			
			else if (status.type === "recent") {
				game["description"] = "Started at " + gameDate.format("h:mm a");
			}
			
			else if (status.type === "future") {
				game["title"] = teamParams.name + " at home, starts at " + gameDate.format("h:mm a");
			}
			  
			games.push(game);
			
		  }

        });

        resolve(games);
	});
}


