var express = require('express');
var router = express.Router();
var request = require('request');
var GoogleSpreadsheet = require("google-spreadsheet");
var moment = require('moment');
var underscore = require('underscore');
var marked = require('marked');
var mlbSchedule = require('../requests/mlbSchedule');
var trafficAlerts = require('../requests/trafficAlerts');
var ctaAlerts = require('../requests/ctaAlerts');
var uber = require('../requests/uber');
var weather = require('../requests/weather');
var c1functions = require('../core/functions');
//var Promise = require('promise');


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

var statusOrder = ["current", "soon", "later", "recent", "past"];



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

		getGoogleSheet().then(function(googleSheet){

			console.log("Callback for getGoogleSheet()");

			assignToADay(weather.data.weatherAlerts);
			assignToADay(weather.data.dailyForecast);
			assignToADay(weather.data.nextRainEvent);
			//uber.on('ready', function() {
			assignToADay(uber.data);
			//});
			assignToADay(trafficAlerts.data);
			assignToADay(mlbSchedule.cubs);
			assignToADay(mlbSchedule.sox);
			assignToADay(ctaAlerts.data);
			assignToADay(googleSheet.customUpdates);

			console.log("After googleSheet.customUpdates");

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



			resolve({
				obstacles: obstacles,
				messageBar: googleSheet.messageBar
			});
			
		}).catch(function(err){
			//if something bad happens inside googlesheet promise
			console.log("Error occurred inside googlesheet promise");
		});
	});
}



function getGoogleSheet() {
	
	return new Promise(function(resolve,reject) {

		var eventType = "custom-update";
	
		// spreadsheet key is the long id in the sheets URL 
		var my_sheet = new GoogleSpreadsheet(process.env.GSHEET_EVENTS);


		my_sheet.getRows(1, function(err, row_data){

			if (err) {
				reject(new Error("Bad response from Google Sheets"));
			}
			
			else {
				var customUpdates = [];
				var messages = [];

				underscore.each(row_data, function(row_json, index) {
					
					var startDate = moment(row_json.startdate, "YYYY-MM-DD HH:mm")
					var endDate = moment(row_json.enddate, "YYYY-MM-DD HH:mm")				
					status = c1functions.determineEventStatus(startDate, endDate, 3);

					
					if (status && status.inDisplayWindow == true) {
					
						var customUpdate = {					
							eventType: eventType,
							title: row_json.title,
							description: marked(row_json.description),
							start: startDate,
							end: endDate,
							severity: row_json.severity,
							source: row_json.source,
							slug: c1functions.convertToSlug_withDate(row_json.title, startDate),
							status: status.type,
							statusRank: statusOrder.indexOf(status.type),
							eventRank: c1functions.eventOrder.indexOf(eventType),
							inDisplayWindow: status.inDisplayWindow,
							hoursUntil: status.hoursUntil
						};

						customUpdate["classNames"] = `${eventType} customUpdate.slug`;

						if (row_json.icon !== "") { customUpdate["icon"] = row_json.icon; } /*"&#x" + customUpdate.icon*/
						if (row_json.morelink !== "") { customUpdate["moreLink"] = row_json.morelink; }
						
						customUpdates.push(customUpdate);				
					}

				});
				
				my_sheet.getRows(2, function(err, row_data){
					
					underscore.each(row_data, function(value,index) {
						
						var slug = c1functions.convertToSlug(value.description);
						var slugTruncated = slug.substring(0, 40);

						messages.push({
							description: marked(value.description),
							dismisscta: value.dismisscta,
							slug: slugTruncated,
							className: slugTruncated
						});

					});

					//console.log(messages);

					resolve({
						customUpdates: customUpdates,
						messageBar: messages
					});

				});
			}
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

		setTimeout(obstaclesInterval, 60000);
	}).catch(function(err) {
		console.log("An error occurred in assembleObstacles(). Executing function again in 60 seconds.");
		setTimeout(obstaclesInterval, 60000);
	});	
}

setTimeout(obstaclesInterval, 2000);


router.get('/', function(req, res, next) {
	
	
	res.render('index', {
		obstacles: obstaclesData,
		currentWeather: weather.data.currentWeather,
		todayWeather: weather.data.todayWeather,
		messageBar: messageBar,
		env: process.env.NODE_ENV
	});
});

module.exports = router;