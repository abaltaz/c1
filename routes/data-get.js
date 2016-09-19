var express = require('express');
var router = express.Router();
var request = require('request');
var GoogleSpreadsheet = require("google-spreadsheet");
var moment = require('moment');
var underscore = require('underscore');
var marked = require('marked');
var googleSheet = require('../requests/googleSheet');
var mlbSchedule = require('../requests/mlbSchedule');
var trafficAlerts = require('../requests/trafficAlerts');
var expTraffic = require('../requests/expTraffic');
var ctaAlerts = require('../requests/ctaAlerts');
var uber = require('../requests/uber');
var weather = require('../requests/weather');
var c1functions = require('../core/functions');
//var Promise = require('promise');


var obstaclesIteration = 0;

var days = [
      "Sunday", 
      "Monday", 
      "Tuesday", 
      "Wednesday", 
      "Thursday", 
      "Friday", 
      "Saturday"
    ];  

var obstaclesData;
var currentWeather;
var obstacles;
var messageBar;

var now;
var inOneDay;
var inTwoDays;
var inThreeDays;


function assembleObstacles() {

	return new Promise(function(resolve,reject) {

		console.log("Executing assembleObstacles() Promise");

		now = moment();
		inOneDay = now.clone().add(1, "day").hour(5);
		inTwoDays = now.clone().add(2, "day").hour(5);
		inThreeDays = now.clone().add(3, "day").hour(5);

		obstacles = {
			today: {
				dayName: days[now.day()],
				dayNum: now.date(),
				currentTime: now.format("h:mma"),
				hasCurrentEvent: false,
				events: []
			},
			nextDays: {
				inOneDay: {
					dayName: days[inOneDay.day()],
					dayNum: inOneDay.date(),
					events: [],
					slug: `next-day-${inOneDay.format("MMDDYY")}`
				},
				inTwoDays: {
					dayName: days[inTwoDays.day()],
					dayNum: inTwoDays.date(),
					events: [],
					slug: `next-day-${inTwoDays.format("MMDDYY")}`
				},
				inThreeDays: {
					dayName: days[inThreeDays.day()],
					dayNum: inThreeDays.date(),
					events: [],
					slug: `next-day-${inThreeDays.format("MMDDYY")}`
				}
			},
			all: [],
			allClear: false,
			numString: ""
		};


		assignToADay(googleSheet.data.customUpdates);
		assignToADay(weather.data.weatherAlerts);
		assignToADay(weather.data.dailyForecast);
		assignToADay(weather.data.nextRainEvent);
		//uber.on('ready', function() {
		assignToADay(uber.data);
		//});
		assignToADay(trafficAlerts.data);
		assignToADay(expTraffic.data);
		assignToADay(mlbSchedule.cubs);
		assignToADay(mlbSchedule.sox);
		assignToADay(ctaAlerts.data);




		if (obstacles.today.events.length === 1) {
			obstacles.numString = "(1 obstacle)"
		}

			else if (obstacles.today.events.length > 1) {
				obstacles.numString = "(" + obstacles.today.events.length + " obstacles)"
			}

			else {
				obstacles.numString = obstacles.today.events.length + "(Smooth sailing)"
			}

		//obstacles.today.events = underscore.sortBy(obstacles.today.events, 'statusRank');
		
		//Sort on event type, then event status

		obstacles.today.events = underscore.sortBy(obstacles.today.events, 'start');
		obstacles.today.events = underscore.sortBy(obstacles.today.events, 'severity');
		obstacles.today.events = underscore.sortBy(obstacles.today.events, 'eventRank');
		obstacles.today.events = underscore.sortBy(obstacles.today.events, 'statusRank');

		underscore.each(obstacles.nextDays, function(nextDay){
			nextDay.events = underscore.sortBy(nextDay.events, 'eventRank');
		});


		resolve({
			obstacles: obstacles,
			messageBar: googleSheet.data.messageBar
		});
			
	});
}



function assignToADay(data) {

	underscore.each(data, function(event,index) {

		obstacles.all.push(event);

		//Rules for displaying an event for Today
		if (event.status === "current" || event.status === "soon" || event.status === "later") {
			obstacles.today.events.push(event);
		}
		
		//Rules for displaying an event for 1 day from now
		if (inOneDay.isSame(event.start, "day") || 
			inOneDay.isBetween(event.start, event.end)) {
			obstacles.nextDays.inOneDay.events.push(event);
		}

		//Rules for displaying an event for 2 days from now
		if (inTwoDays.isSame(event.start, "day") || 
			inTwoDays.isBetween(event.start, event.end)) {
			obstacles.nextDays.inTwoDays.events.push(event);
		}
	
		//Rules for displaying an event for 3 days from now
		if (inThreeDays.isSame(event.start, "day") || 
			inThreeDays.isBetween(event.start, event.end)) {
			obstacles.nextDays.inThreeDays.events.push(event);
		}

		//If the event is current, set hasCurrentEvent to true -- use for "All Clear" message 
		if (event.status === "current" || event.status === "soon") {
			obstacles.today.hasCurrentEvent = true;
		}

	});

	//

}


function obstaclesInterval() {
	assembleObstacles().then(function(data){
		console.log("Running in " + process.env.NODE_ENV + " environment.");
		
		obstaclesData = data.obstacles;
		messageBar = data.messageBar;

		obstaclesIteration++;

		setTimeout(obstaclesInterval, 60000);
	}).catch(function(err) {
		console.log("An error occurred in assembleObstacles(). Executing function again in 60 seconds.", err);
		setTimeout(obstaclesInterval, 60000);
	});	
}

setTimeout(obstaclesInterval, 8000);


router.get('/', function(req, res, next) {
	
	
	res.render('index', {
		obstacles: obstaclesData,
		currentWeather: weather.data.currentWeather,
		todayWeather: weather.data.todayWeather,
		messageBar: messageBar,
		env: process.env.NODE_ENV,
		obstaclesIteration: obstaclesIteration
	});
});

module.exports = router;