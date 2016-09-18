var express = require('express');
var router = express.Router();
var request = require('request');
var GoogleSpreadsheet = require("google-spreadsheet");
var moment = require('moment');
var underscore = require('underscore');
var parseString = require('xml2js').parseString;


module.exports.statusOrder = ["current", "soon", "later", "recent", "past"];
module.exports.eventOrder = ["daily-forecast", "weather-alert", "rain", "transit", "uber", "game", "traffic", "custom-update"];

module.exports.doRequest = function(endpoint, endpointFormat){
	return new Promise(function(resolve,reject) {
		request(endpoint, function(error, response, body) {
			
			//console.log(`Request made to ${endpoint} at ${moment().format('hh:mm:ss')}`);
			
			if (!error && response.statusCode == 200) {
			
				if (endpointFormat === "json") {
					resolve(JSON.parse(body));
				}
				else if (endpointFormat === "xml") {
					resolve(body);
				}
			}
			
			else {
				console.log("there was an error");
				resolve(Error);
			}
			
		});
	});
}


module.exports.convertToSlug = function(Text) {
    return Text.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-');
}

module.exports.convertToSlug_withDate = function(Text, Date) {	
	var t = Text.toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-');
	var d = Date.format("-MMDDYY-HHmm");

	return t + d;

}

module.exports.determineEventStatus = function(startDate, endDate, futureThreshold) {
  
    var status = {
    	type: "",
		inDisplayWindow: false
    };
	
    var now = moment();
    var hoursUntil = now.diff(startDate, 'hours');
    
  
    //Throw error if endDate is same AND earlier that startDate
    if (startDate.isSame(endDate) === false && 
        startDate.isBefore(endDate) === false) {
        return(new Error("Start Date is after End Date"));
    }
    
    //If the event starts less than N days from the current day
    if (startDate.diff(now, 'days') <= futureThreshold ) {
  
  	  //An event is CURRENT if the current time is between the start and end dates, 
  	  //OR the current day is the same as the start date AND the start time and end time are the same
      if (now.isBetween(startDate, endDate) ||
         (now.isSame(startDate, 'day') && startDate.isSame(endDate))) {
        status.type = "current";
    	status.weightTime = 10;
      }

        else if (now.isSame(startDate, 'day') &&
		         now.isBefore(startDate) && 
		         hoursUntil >= -2) {	

		         	status.type = "soon";
		     	 	status.weightTime = 5;
        }

        else if (now.isSame(startDate, 'day') &&
                 now.isBefore(startDate)  && 
		         hoursUntil < -2) {
                 
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

	//console.log(status);

    return status;
      
}

function assignToADay(data) {

	console.log("assignToADay-1", obstacles.nextDays.inOneDay);

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

	});

	//console.log("assignToADay-2", data.start, obstacles.nextDays.inOneDay);
}