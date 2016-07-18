var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var EventEmitter = require('events');
var c1functions = require('../core/functions');


var weatherEndpoint = "https://api.forecast.io/forecast/783d0532d2e2a62cd4fea9df27df5414/41.8369,-87.6847"

getWeatherInterval();

function getWeatherInterval() {
	getWeather().then(function(data) {
		//console.log("HELLO RAIN9", data);
		module.exports.data = data;
	});

	setTimeout(getWeatherInterval, 300000);

};


function getWeather() {
	return new Promise(function(resolve,reject) {
		c1functions.doRequest(weatherEndpoint, "json").then(function(forecast){	
			
			if (forecast == Error) {
				reject(new Error("Bad response from Forecast.io endpoint"));
			}
			
			else {	
				
		        var currentTime = moment();
		        var tomorrowDate = moment().add(1, 'day').set("hour", 0).set("minute", 0);
        
        		var nextRainEvent;
		        var rainStatus = {
		          rainToday: false,
		          rainTodayDetails: [],
		          rainTodayString: "",
		      	  rainTodayTitle: forecast.hourly.summary
		        };
        		

		        //Iterate through the hourly forecast
		        underscore.each(forecast.hourly.data, function(forecast,index) {
          
		          var forecastTime = moment(forecast.time * 1000);
        

          
		          //If the hourly forecast is between now and tomorrow
		          if (forecastTime.isAfter(currentTime) && forecastTime.isBefore(tomorrowDate)) {
                      
		            //Determine likelihood of rain
		            if (forecast.precipProbability > 0.24) {

		              rainStatus.rainToday = true;

		              //function to set string based on probability of rain
		              var probablity = function() {

		              	   console.log("HI", forecast.precipProbability, forecastTime.format("MM/DD HH:mm"), forecast.time);

			              if (forecast.precipProbability > 0.24 && forecast.precipProbability <= 0.5) {
			                    return "Slight chance"
			              }
			                  
		                  else if (forecast.precipProbability > 0.5 && forecast.precipProbability <= 0.75) {
		                    	return "Good chance"
		                  }
		                  
		                  else if (forecast.precipProbability > 0.75 && forecast.precipProbability <= 1) {
		                    	return "Very good chance"
		                  }
		              
		              }


  		              if (rainStatus.rainTodayString === "") {
		              	rainStatus.rainTodayString = probablity() + " of rain at " + forecastTime.format("ha");
		          	  }


		              rainStatus.rainTodayDetails.push({
		                time: forecastTime.format("ha"),
		                startDate: forecastTime,
		                endDate: forecastTime.clone().add(1, "hours"),
		                intensity: forecast.precipIntensity,
		                summary: forecast.summary,
		                probablity: probablity(),
		                occurence: rainStatus.rainToday
		              });
            
		            }
          
		          }
          
		        });

		        if (rainStatus.rainToday) {
				
					var status = c1functions.determineEventStatus(rainStatus.rainTodayDetails[0].startDate, 
										 			  			  rainStatus.rainTodayDetails[0].endDate,
										 			  			  1);
					

					var rainEvent = {
						occurence: rainStatus.rainToday,
						title: rainStatus.rainTodayString,
						description: rainStatus.rainTodayTitle,
						start: rainStatus.rainTodayDetails[0].startDate,
						end: rainStatus.rainTodayDetails[0].endDate,
						category: "weather",
						eventType: "rain",
						inDisplayWindow: status.inDisplayWindow,
						status: status.type,
						statusRank: c1functions.statusOrder.indexOf(status.type),
						eventRank: c1functions.eventOrder.indexOf("rain"),
						slug: c1functions.convertToSlug_withDate("rain", rainStatus.rainTodayDetails[0].startDate)
					}

					rainEvent["classNames"] = `rain ${rainEvent.slug}`;
					nextRainEvent = rainEvent;
				
				}

				else {
					nextRainEvent = false;
				}
		    	
        	
				//Get Weather Alerts
				var weatherAlerts = [];
			
				if (typeof forecast.alerts !== "undefined") {
				
					underscore.each(forecast.alerts, function(alert, index) {

						if (alert.title.indexOf("Air Quality") === -1 && 
							alert.title.indexOf("Statement") === -1) {

							var startDate = moment(alert.time * 1000);
							var endDate = moment(alert.expires * 1000);
							var status = c1functions.determineEventStatus(startDate, endDate, 3);

							if (status && status.inDisplayWindow == true) {

								var endDateString;

								if (moment().isSame(endDate, 'day')) {
									endDateString = endDate.format("h:mm A");
								}

								else if (moment().isBefore(endDate, 'day')) {
									endDateString = endDate.format("h:mm A on MMMM D");
								}

								var alert = {
										string: alert.title + ". Starts at " + startDate.format("h:mm A on M/D")
											    + " and is expected to end at " + endDate.format("h:mm A on M/D"),
										alertNow: true,
										inDisplayWindow: status.inDisplayWindow,
										status: status.type,
										statusRank: c1functions.statusOrder.indexOf(status.type),
										eventType: "weather-alert",
										eventRank: c1functions.eventOrder.indexOf("weather-alert"),
										start: startDate,
										end: endDate,
										slug: c1functions.convertToSlug_withDate(alert.title, startDate),
										title: alert.title,
										description: "Expected to end at " + endDateString,
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

					var status = c1functions.determineEventStatus(startDate, startDate, 3);

					var thisForecast = {
						inDisplayWindow: status.inDisplayWindow,
						status: status.type,
						statusRank: c1functions.statusOrder.indexOf(status.type),
						start: startDate,
						end: startDate,
						slug: c1functions.convertToSlug_withDate("forecast", startDate),
						title: day.summary
								 + " High " + Math.round(day.temperatureMax) + "°"
					};

					thisForecast["classNames"] = "forecast " + thisForecast.slug;

					dailyForecast.push(thisForecast);

				});

				dailyForecast.splice(0,1);
			
		        resolve({
					nextRainEvent: [nextRainEvent],
					weatherAlerts: weatherAlerts,
					dailyForecast: dailyForecast,
					currentWeather: `${Math.round(forecast.currently.temperature)}° ${forecast.currently.summary}`,
					todayWeather: `${forecast.daily.data[0].summary} High ${Math.round(forecast.daily.data[0].temperatureMax)}°`
				});
			
			}
			
		});
	});
}