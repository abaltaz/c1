var express = require('express');
var router = express.Router();
var request = require('request');
var GoogleSpreadsheet = require("google-spreadsheet");
var moment = require('moment');
var underscore = require('underscore');
var parseString = require('xml2js').parseString;
var marked = require('marked');
var mlbSchedule = require('../requests/mlbSchedule');
var trafficAlerts = require('../requests/trafficAlerts');
var uber = require('../requests/uber');
var weather = require('../requests/weather');
var c1functions = require('../core/functions');
//var Promise = require('promise');


var endpoints = {
	forecast: "https://api.forecast.io/forecast/783d0532d2e2a62cd4fea9df27df5414/41.8369,-87.6847",
	cubs: "https://api.myjson.com/bins/4bg78",
	sox: "https://api.myjson.com/bins/5any4",
	ctaTrains: "http://www.transitchicago.com/api/1.0/alerts.aspx?routeid=red,blue,org,brn,g,pexp"
};

var cubsParams = {
  name: "Cubs",
  schedule: "https://api.myjson.com/bins/4bg78",
  dateFormat: "MM/YY/DD",
  dateIdentifier: "START DATE",
  timeIdentifier: "START TIME"
};

var soxParams = {
  name: "Sox",
  schedule: "https://api.myjson.com/bins/5any4",
  dateFormat: "MM/YY/DD",
  dateIdentifier: "START DATE",
  timeIdentifier: "START TIME"
};

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
var hasCurrentUpdate;
var messageBar;

var now;
var inOneDay;
var inTwoDays;
var inThreeDays;

var statusOrder = ["current", "soon", "later", "recent", "past"];

var obstacles = {};

/*

mlbSchedule.getcubs.on('ready', function() {
	console.log("mlbcubs19", mlbSchedule.cubs);
});

mlbSchedule.getsox.on('ready', () => {
	console.log("mlbsox19", mlbSchedule.sox);
});
*/


function assembleObstacles() {

	return new Promise(function(resolve,reject) {

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

		getCtaStatus().then(function(transitAlerts){
			
			assignToADay(transitAlerts);

			return getGoogleSheet()

		}).catch(function(err){
			
			return getGoogleSheet()

		}).then(function(googleSheet){

			assignToADay(weather.data.weatherAlerts);
			assignToADay(weather.data.dailyForecast);
			assignToADay(weather.data.nextRainEvent);
			//uber.on('ready', function() {
			console.log('uber1', uber.data);
			assignToADay(uber.data);
			//});
			assignToADay(trafficAlerts.data);
			assignToADay(mlbSchedule.cubs);
			assignToADay(mlbSchedule.sox);
			assignToADay(googleSheet.customUpdates);

			

			/*

			if (weather.data.rainStatus.rainToday) {
				
				var status = determineEventStatus(weather.data.rainStatus.rainTodayDetails[0].startDate, 
									 			  weather.data.rainStatus.rainTodayDetails[0].endDate,
									 			  1);
				

				var rainEvent = {
					occurence: weather.data.rainStatus.rainToday,
					title: weather.data.rainStatus.rainTodayString,
					description: weather.data.rainStatus.rainTodayTitle,
					startDate: weather.data.rainStatus.rainTodayDetails[0].startDate.format("MM/DD hh:mma"),
					endDate: weather.data.rainStatus.rainTodayDetails[0].endDate.format("MM/DD hh:mma"),
					category: "weather",
					type: "rain",
					inDisplayWindow: status.inDisplayWindow,
					status: status.type,
					statusRank: c1functions.statusOrder.indexOf(status.type),
					eventRank: c1functions.eventOrder.indexOf("rain"),
					slug: convertToSlug_withDate("rain", weather.data.rainStatus.rainTodayDetails[0].startDate)
				}

				console.log("HELLO RAIN5", rainEvent);

				rainEvent["classNames"] = `rain ${rainEvent.slug}`;

				obstacles.today.events.push(rainEvent);
			
			}

			*/

			/*
			underscore.each(data.weatherAlerts, function(weatherAlert,index){
				obstacles.today.events.push({
					occurence: weatherAlert.alertNow,
					description: weatherAlert.string,
					category: "weather",
					type: "weather-alert"
				});
			});
			*/

			/*
			//Determine if there are NO current updates
			hasCurrentUpdate = false;
			for (var obstacle in obstacles) {
				if (obstacles[obstacle].occurence == true){
					hasCurrentUpdate = true;
				}
			}
			*/

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
			obstacles.today.events = underscore.sortBy(obstacles.today.events, 'eventRank');
			obstacles.today.events = underscore.sortBy(obstacles.today.events, 'statusRank');



			resolve({
				obstacles: obstacles,
				//hasCurrentUpdate: hasCurrentUpdate,
				messageBar: googleSheet.messageBar
			});
			
		});
	});
}



function getGoogleSheet() {
	
	return new Promise(function(resolve,reject) {

		var eventType = "custom-update";
	
		// spreadsheet key is the long id in the sheets URL 
		var my_sheet = new GoogleSpreadsheet(process.env.GSHEET_EVENTS);


		my_sheet.getRows(1, function(err, row_data){
			
			var customUpdates = [];
			var messages = [];

			underscore.each(row_data, function(row_json, index) {
				
				var startDate = moment(row_json.startdate, "YYYY-MM-DD HH:mm")
				var endDate = moment(row_json.enddate, "YYYY-MM-DD HH:mm")				
				status = determineEventStatus(startDate, endDate, 3);

				
				
				if (status && status.inDisplayWindow == true) {
				
					var customUpdate = {					
						eventType: eventType,
						title: row_json.title,
						description: marked(row_json.description),
						start: startDate,
						end: endDate,
						severity: row_json.severity,
						source: row_json.source,
						slug: convertToSlug_withDate(row_json.title, startDate),
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
				
		
		});
	
	});
}

function getCtaStatus() {
	return new Promise(function(resolve,reject) {
		doRequest(endpoints.ctaTrains, "xml").then(function(data){
			parseString(data, function(err, xmlToJsonResults) {
				
				ctaStatus = xmlToJsonResults.CTAAlerts.Alert;
				
				var majorAlerts = [];
				var now = moment();
				//moment().add(4, "days");
	
				underscore.each(ctaStatus, function(alert, index) {

		
					if (parseInt(alert.SeverityScore[0]) > 35) {

						var alertStart = moment(alert.EventStart[0], "YYYYMMDD HH:mm");
						var alertEnd; 

						if (alert.EventEnd[0] !== "") {
							alertEnd = moment(alert.EventEnd[0], "YYYYMMDD HH:mm");
						}

						else {
							alertEnd = alertStart;
						}

						var status = determineEventStatus(alertStart, alertEnd, 2);

						//If the CTA alert occurs anytime on the present day
						//if (now.isSame(alertStart, "date") || now.isBetween(alertStart, alertEnd)) {
						if (status && status.inDisplayWindow == true) {
													
							//Iterate through each impacted service (e.g. RedLine) and store it
							//var impactedServices = [];
							
							//Add an object for this alert to the majorAlerts array				
							var majorAlert = {
								title: alert.Headline[0],
								description: alert.ShortDescription[0],
								start: alertStart,
								end: alertEnd,
								//impactedService: convertToSlug(alert.ImpactedService[0].Service[0].ServiceName[0]),
								inDisplayWindow: status.inDisplayWindow,
								status: status.type,
								statusRank: c1functions.statusOrder.indexOf(status.type),
								eventRank: c1functions.eventOrder.indexOf('transit'),
								slug: convertToSlug_withDate(alert.Headline[0], alertStart)
							};

							majorAlert["classNames"] = "cta transit " + majorAlert.slug;

							if (now.isBefore(alertStart)) {
								majorAlert["dateString"] = "Starts at " + alertStart.format("h:mma")
							}

							else if (now.isSame(alertEnd, "day") && alertStart !== alertEnd) {
								majorAlert["dateString"] = "Ends at " + alertEnd.format("h:mma [today]");
							}

							else if (alertStart !== alertEnd) {
								majorAlert["dateString"] = "Ends on " + alertEnd.format("MMMM D [at] h:mma");
							}

							majorAlerts.push(majorAlert);
							
							/*
							//If an alert has multiple impact routes, create a new object for each impacted
							underscore.each(alert.ImpactedService[0].Service, function(Service, index){
								
								if (Service.ServiceId[0] == "Red" ||
									Service.ServiceId[0] == "Blue" ||
									Service.ServiceId[0] == "Org" ||
									Service.ServiceId[0] == "Brn" ||
									Service.ServiceId[0] == "G" ||
									Service.ServiceId[0] == "P" ||
									Service.ServiceId[0] == "Pexp") {
										
										//Add an object for this alert to the majorAlerts array				
										majorAlerts.push({
											headline: alert.Headline[0],
											description: alert.ShortDescription[0],
											start: alert.EventStart[0],
											end: alert.EventEnd[0],
											impactedService: convertToSlug(Service.ServiceName[0]),
											inDisplayWindow: timeStatus.inDisplayWindow,
											timeStatus: timeStatus.type
											
										});
								}
							});
							*/
				
						}
					}
		
				});
				
				
				resolve(majorAlerts);
				
			});
		});
	});
}


function doRequest(endpoint, endpointFormat){
	return new Promise(function(resolve,reject) {
		request(endpoint, function(error, response, body) {
			
			
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

function convertToSlug(Text) {
    return Text
        .toLowerCase()
        .replace(/[^\w ]+/g,'')
        .replace(/ +/g,'-')
        ;
}

function convertToSlug_withDate(Text, Date) {	
	var t = Text.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-');
	var d = Date.format("-MMDDYY-HHmm");

	return t + d;

}

function determineEventStatus(startDate, endDate, futureThreshold) {
  
    var status = {
    	type: "",
		inDisplayWindow: false
    };
	
    var now = moment();
    var hoursUntil = Math.abs(now.diff(startDate, 'hours'));
    status.hoursUntil = hoursUntil;

  
    //
    //
    //
  
  
    //Throw error if endDate is same AND earlier that startDate
    if (startDate.isSame(endDate) === false && 
        startDate.isBefore(endDate) === false) {
        return(new Error("Start Date is after End Date"));
    }
    
    //If the event starts less than N days from the current day
    if (startDate.diff(now, 'days') <= futureThreshold ) {
  
      if (now.isBetween(startDate, endDate) ||
         (now.isSame(startDate, 'day') && startDate.isSame(endDate))) {
        status.type = "current";
    	status.weightTime = 10;
      }

        else if (now.isSame(startDate, 'day') &&
		         now.isBefore(startDate) && 
		         hoursUntil <= 1) {	

		         	status.type = "soon";
		     	 	status.weightTime = 5;
        }

        else if (now.isSame(startDate, 'day') &&
                 now.isBefore(startDate)  && 
		         hoursUntil > 1) {
                 
                 status.type = "later";
             	 status.weightTime = 5;
        }

        else if (now.isBefore(startDate, 'day')) {
                status.type = "future";
        }

        else if (now.isSame(endDate, 'day') &&
                 now.isAfter(endDate)) {
                status.type = "recent";
        }

        else if (now.isAfter(endDate, 'day')) {
                status.type = "past";
        }

    }
  
    else {
      return false;
    }
	
	if (status.type === "current" || status.type === "soon" || status.type === "later" || status.type === "future" || status.type === "recent") {
		status.inDisplayWindow = true;
	}

	//

    return status;
      
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
		console.log("Running in " + process.env.NODE_ENV + " environment: " + moment().format("MM/DD hh:mma"));
		obstaclesData = data.obstacles;
		console.log(obstaclesData);
		//hasCurrentUpdate = data.hasCurrentUpdate;
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
		//hasCurrentUpdate: hasCurrentUpdate,
		messageBar: messageBar
	});
});

module.exports = router;