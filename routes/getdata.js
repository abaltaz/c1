var express = require('express');
var router = express.Router();
var request = require('request');
var GoogleSpreadsheet = require("google-spreadsheet");
var moment = require('moment');
var underscore = require('underscore');
var parseString = require('xml2js').parseString;
var Promise = require('promise');


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

	var now = moment();
	var inOneDay = now.clone().add(1, "day").hour(0);
	var inTwoDays = now.clone().add(2, "day").hour(0);
	var inThreeDays = now.clone().add(3, "day").hour(0);

	var obstacles = {};



function assembleObstacles() {

	obstacles = {
		today: {
			dayName: days[now.day()],
			dayNum: now.date(),
			events: []
		},
		nextDays: {
			inOneDay: {
				dayName: days[inOneDay.day()],
				dayNum: inOneDay.date(),
				events: []
			},
			inTwoDays: {
				dayName: days[inTwoDays.day()],
				dayNum: inTwoDays.date(),
				events: []
			},
			inThreeDays: {
				dayName: days[inThreeDays.day()],
				dayNum: inThreeDays.date(),
				events: []
			}
		},
		all: [],
		allClear: false,
		numString: ""
	};

	return new Promise(function(resolve,reject) {

		
		getRainStatus().then(function(data){
			console.log('getrainstatus, then...');

			if (data.rainStatus.rainToday) {

				obstacles.today.events.push({
					occurence: data.rainStatus.rainToday,
					title: data.rainStatus.rainTodayString(),
					category: "weather",
					type: "rain",
					classNames: "rain",
					description: data.rainStatus.rainTodayTitle
				});
			
			}

			assignToADay(data.weatherAlerts);
			assignToADay(data.dailyForecast);

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
			
			return getGameStatus(cubsParams)
		}).catch(function(err){
			console.log('getrainstatus Catch', err);
			return getGameStatus(cubsParams);	
		}).then(function(data){
			
			assignToADay(data);
			
			return getGameStatus(soxParams)
			
		}).then(function(data) {
			console.log("BLASDS");
			assignToADay(data);
			


			return getCtaStatus()
			
		}).then(function(data){
			
			assignToADay(data);
			
			return getTraffic()
			
		}).then(function(data){
			
			console.log("obt1", data);

			assignToADay(data);
			
			return getGoogleSheet()
			
		}).then(function(data){

			console.log("GS", data);
			
			assignToADay(data);

			/*
			underscore.each(data, function(customUpdate,index){
				obstacles[customUpdate.title + (index + 1)] = {
					occurence: customUpdate.isCurrent,
					description: customUpdate.description,
					category: "custom-update",
					type: customUpdate.title,
					title: customUpdate.title,
					icon:  "&#x" + customUpdate.icon
				}
			});
			*/
			
			//Determine if there are NO current updates
			hasCurrentUpdate = false;
			for (var obstacle in obstacles) {
				if (obstacles[obstacle].occurence == true){
					hasCurrentUpdate = true;
				}
			}

			if (obstacles.today.events.length === 1) {
				obstacles.numString = "(1 obstacle)"
			}

			else if (obstacles.today.events.length > 1) {
				obstacles.numString = "(" + obstacles.today.events.length + " obstacles)"
			}

			else {
				obstacles.numString = obstacles.today.events.length + "(Smooth sailing)"
			}

			
			resolve({
				obstacles: obstacles,
				hasCurrentUpdate: hasCurrentUpdate
			});
			
		});
	});
}



function getGoogleSheet() {
	
	return new Promise(function(resolve,reject) {
	
		// spreadsheet key is the long id in the sheets URL 
		var my_sheet = new GoogleSpreadsheet('1tg5uQadbOIUv-rxrCWhiIgDmwnaGkT7jJrb6rxurkfI');
	
		my_sheet.getRows( 1, function(err, row_data){
			
			//console.log( 'pulled in ' + JSON.stringify(row_data) + ' rows');
			
			var customUpdates = [];
			
			underscore.each(row_data, function(row_json, index) {
				
				var startDate = moment(row_json.startdate, "YYYY-MM-DD HH:mm:ss")
				var endDate = moment(row_json.enddate, "YYYY-MM-DD HH:mm:ss")				
				status = determineEventStatus(startDate, endDate, 3);

				console.log(endDate);
				
				if (status && status.inDisplayWindow == true) {
				
					var customUpdate = {					
						title: row_json.title,
						description: row_json.description,
						icon: "&#x" + row_json.icon,
						start: startDate,
						end: endDate,
						severity: row_json.severity,
						source: row_json.source,
						slug: convertToSlug_withDate(row_json.title, startDate),
						status: status.type,
						inDisplayWindow: status.inDisplayWindow
					};

					customUpdate["classNames"] = "custom-update " + customUpdate.slug;

					if (row_json.morelink !== "") { customUpdate["moreLink"] = row_json.morelink }
					
					customUpdates.push(customUpdate);				
				}

			});
			
			console.log("google-sheet", customUpdates);
				
			resolve(customUpdates);
		
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
						var alertEnd = moment(alert.EventEnd[0], "YYYYMMDD HH:mm");

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
								slug: convertToSlug_withDate(alert.Headline[0], alertStart)
							};

							majorAlert["classNames"] = "cta transit " + majorAlert.slug;

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
				
				console.log(majorAlerts);
				resolve(majorAlerts);
				
			});
		});
	});
}


function getGameStatus(teamParams) {
	return new Promise(function(resolve,reject) {
		doRequest(teamParams.schedule, "json").then(function(data){
        
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
			  var gameEnd = gameDate.clone().add(5, "hours");
 
			  
			  var status = determineEventStatus(gameDate, gameEnd, 3);
			  
			  if (status && status.inDisplayWindow == true) {

				var game = {
			  		inDisplayWindow: status.inDisplayWindow,
					status: status.type,
					start: gameDate,
					end: gameEnd,
					title: teamParams.name + " game in Chicago",
					slug: convertToSlug_withDate(teamParams.name, gameDate)
				};

				game["classNames"] = "game " + teamParams.name.toLowerCase() + " " + game.slug;
				
				if (status.type === "current") {
					game["description"] = "Started at " + gameDate.format("h:mm A");
				}

				if (status.type === "later") {
					game["description"] = "Starts at " + gameDate.format("h:mm A");
				}
				
				else if (status.type === "recent") {
					game["description"] = "Starts at " + gameDate.format("h:mm A");
				}
				
				else if (status.type === "future") {
					game["title"] = teamParams.name + " at home, starts at " + gameDate.format("MM/DD h:mm A");
				}
				  
				games.push(game);
				
			  }

	        });
			
	        resolve(games);
		});
	});
}
		


function getRainStatus() {
	return new Promise(function(resolve,reject) {
		doRequest(endpoints.forecast, "json").then(function(forecast){	
			
			if (forecast == Error) {
				reject(new Error("Bad response from Forecast.io endpoint"));
			}
			
			else {
				
				console.log('processing rain status');
				
		        var currentTime = moment();
		        var tomorrowDate = moment().add(1, 'day').set("hour", 0).set("minute", 0);
        
		        var rainStatus = {
		          rainToday: false,
		          rainTodayDetails: [],
		          rainTodayString: function() {
		            if (rainStatus.rainToday) {
		              return  rainStatus.rainTodayDetails[0].probablity() + " of rain at " + rainStatus.rainTodayDetails[0].time
		            }
		            else return ""
		          },
		      	  rainTodayTitle: forecast.hourly.summary,	
		          currentWeather: 
		            Math.round(forecast.currently.temperature) + "° " 
		            + forecast.currently.summary
		        };
			
				//Store the current weather
				currentWeather = rainStatus.currentWeather;
        
		        //Iterate through the hourly forecast
		        underscore.each(forecast.hourly.data, function(forecast,index) {
          
		          var forecastTime = moment(forecast.time * 1000);
        
          
		          //If the hourly forecast is between now and tomorrow
		          if (forecastTime.isAfter(currentTime) && 
		              forecastTime.isBefore(tomorrowDate)) {
                      
            
		            //Determine likelihood of rain
		            if (forecast.precipProbability > 0.24) {
		              rainStatus.rainToday = true;
		              rainStatus.rainTodayDetails.push({
		                time: forecastTime.format("ha"), 
		                intensity: forecast.precipIntensity,
		                summary: forecast.summary,
		                probablity: function() {
		                  rainStatus.rainToday = false;
		                  if (forecast.precipProbability > 0.25 &&
		                           forecast.precipProbability < 0.49) {
		                    return "Slight chance"
		                  }
		                  else if (forecast.precipProbability > 0.5 &&
		                           forecast.precipProbability < 0.74) {
		                    return "Good chance"
		                  }
		                  else if (forecast.precipProbability > 0.75 &&
		                           forecast.precipProbability <= 1) {
		                    return "Very good chance"
		                  }
		                }
		              }); 
            
            
		            }
            
            
          
		          }
          
		        });


        	
				//Get Weather Alerts
				var weatherAlerts = [];
			
				if (typeof forecast.alerts !== "undefined") {
				
					underscore.each(forecast.alerts, function(alert, index) {

						if (alert.title.indexOf("statement") === -1 && alert.title.indexOf("Statement") === -1) {

							var startDate = moment(alert.time * 1000);
							var endDate = moment(alert.expires * 1000);
							var status = determineEventStatus(startDate, endDate, 3);

							if (status && status.inDisplayWindow == true) {

								var alert = {
										string: alert.title + ". Starts at " + startDate.format("h:mm A on M/D")
											    + " and is expected to end at " + endDate.format("h:mm A on M/D"),
										alertNow: true,
										inDisplayWindow: status.inDisplayWindow,
										status: status.type,
										start: startDate,
										end: endDate,
										slug: convertToSlug_withDate(alert.title, startDate),
										title: alert.title,
										description: "Starts at " + startDate.format("h:mm A on MMMM D")
											    + " and is expected to end at " + endDate.format("h:mm A on MMMM D"),
										moreLink: alert.uri
									};

								alert["classNames"] = "weather-alert " + alert.slug;

								weatherAlerts.push(alert);	

							}
						}

					});
				}
			

				//Get Daily Forecast

				var dailyForecast = [];

				underscore.each(forecast.daily.data, function(day, index) {
				

					var startDate = moment(day.time * 1000);

					var status = determineEventStatus(startDate, startDate, 3);

					var thisForecast = {
						inDisplayWindow: status.inDisplayWindow,
						status: status.type,
						start: startDate,
						end: startDate,
						slug: convertToSlug_withDate("forecast", startDate),
						title: day.summary
								 + " High " + Math.round(day.temperatureMax) + "°"
					};

					thisForecast["classNames"] = "forecast " + thisForecast.slug;

					dailyForecast.push(thisForecast);

				});

				//Remove today's forecast because it's not currently needed
				dailyForecast.splice(0,1);
			
		        resolve({
					rainStatus: rainStatus,
					weatherAlerts: weatherAlerts,
					dailyForecast: dailyForecast
				});
			
			}
			
		});
	});
}

var trafficRoutes = {
	lsd_nb: {
		name: "Lake Shore Drive Northbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.LAKESHORE.LAKE%20SHORE%20DRIVE%20NB"
	},
	lsd_sb: {
		name: "Lake Shore Drive Southbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.LAKESHORE.LAKE%20SHORE%20DRIVE%20SB"
	}
};


function getTraffic() {

	return new Promise(function(resolve,reject) {

		var trafficAlerts=[];

		//Iterate through each Traffic Route endpoint
		underscore.each(trafficRoutes, function(route, index) {

			//Make the request for each route
			doRequest(route.endpoint, "json").then(function(road){

				//Array containing html strings for each traffic alert item
				var segmentAlertsHtml = [];

				//Iterate through each road-segment object in the response from IDOT
				underscore.each(road, function(roadSegment){

					//Store an object as a string if the road is congested
					if (roadSegment.level === "HEAVY_CONGESTION") {
						segmentAlertsHtml.push("<li>" + roadSegment.from + " to " + roadSegment.to + "</li>");
					}

				});

				if (segmentAlertsHtml.length > 0) {

					console.log("SAH1", segmentAlertsHtml.toString());
					var description = "Traffic in these areas: <ul>" + segmentAlertsHtml.join("") + "</ul>";
					var startDate = moment();

					var status = determineEventStatus(startDate, startDate, 1);

					var alert = {
						description: description,
						title: route.name,
						start: startDate,
						end: startDate,
						inDisplayWindow: status.inDisplayWindow,
						status: status.type,
						slug: convertToSlug_withDate(route.name, startDate)
					};


					
					alert["classNames"] = "traffic " + alert.slug;

					trafficAlerts.push(alert);
				}

			});

		});

		//Need to figure out how to structure this Promise without a setTimeout
		setTimeout(function() {
			console.log("TR16", trafficAlerts);
			resolve(trafficAlerts);
		},100);



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

  
    //console.log(now.format("MM/DD/YY hh:mma"));
    //console.log(startDate.format("MM/DD/YY hh:mma"));
    //console.log(endDate.format("MM/DD/YY hh:mma"));
  
  
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
      }

        else if (now.isSame(startDate, 'day') &&
                 now.isBefore(startDate)) {
                 status.type = "later";
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
	
	if (status.type === "current" || status.type === "later" || status.type === "future" || status.type === "recent") {
		status.inDisplayWindow = true;
	}

	//console.log(status);

    return status;
      
}

function assignToADay(data) {

	console.log("assignToADay-1", obstacles.nextDays.inOneDay);

	underscore.each(data, function(event,index) {

		obstacles.all.push(event);

		if (event.status === "current" || event.status === "later") {
			obstacles.today.events.push(event);
		}
	
		if (inOneDay.isSame(event.start, "day") || 
				 inOneDay.isBetween(event.start, event.end)) {
			obstacles.nextDays.inOneDay.events.push(event);
		}

		if (inTwoDays.isSame(event.start, "day") || 
				 inTwoDays.isBetween(event.start, event.end)) {
			obstacles.nextDays.inTwoDays.events.push(event);
		}
	
		if (inThreeDays.isSame(event.start, "day") || 
				 inThreeDays.isBetween(event.start, event.end)) {
			obstacles.nextDays.inThreeDays.events.push(event);
		}

	});

	//console.log("assignToADay-2", data.start, obstacles.nextDays.inOneDay);

}


function obstaclesInterval() {
	assembleObstacles().then(function(data){
		obstaclesData = data.obstacles;
		hasCurrentUpdate = data.hasCurrentUpdate;
		console.log("Requesting C1 data...", obstaclesData);
		setTimeout(obstaclesInterval, 1800000);
	});	
}

obstaclesInterval();


router.get('/', function(req, res, next) {
	console.log("hello", obstaclesData);
	console.log("today", obstaclesData.today.events);
	res.render('index', {
		obstacles: obstaclesData,
		currentWeather: currentWeather,
		hasCurrentUpdate: hasCurrentUpdate
	});
});

module.exports = router;

/*
function calc_a(x) {
	return new Promise(function(resolve, reject){

	  var a = x;
	  var b = 10;

	  resolve(a+b);

	});
}
    
function calc_b(x) {
	return new Promise(function(resolve, reject){

	  var a = x;
	  var b = 100;

	  resolve(a+b);

	});
}
    	




calc_a(10).then(function(data_a){
	      console.log(data_a);
	      return calc_b(100)
	    }).then(function(data_b){
	      console.log(data_b);
	    });
*/