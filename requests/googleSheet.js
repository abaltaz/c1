var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var GoogleSpreadsheet = require("google-spreadsheet");
var marked = require('marked');
var EventEmitter = require('events');
var c1functions = require('../core/functions');


getGoogleSheetInterval();

function getGoogleSheetInterval() {
	getGoogleSheet().then(function(data) {
		module.exports.data = data;
		setTimeout(getGoogleSheetInterval, 60000);
	}).catch(function(err){
		setTimeout(getGoogleSheetInterval, 60000);
		console.log("Error with processing Google Sheet. Trying again in 1 minute.");
	});
};


function getGoogleSheet() {

	console.log("getGoogleSheet()");
	
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
							statusRank: c1functions.statusOrder.indexOf(status.type),
							eventRank: c1functions.eventOrder.indexOf(eventType),
							inDisplayWindow: status.inDisplayWindow,
							hoursUntil: status.hoursUntil
						};

						customUpdate["classNames"] = `${eventType} customUpdate.slug`;

						if (status.type === "later") {
							customUpdate["dateString"] = "Starts at " + customUpdate.start.format("h:mm a");
						}

						else if (status.type === "soon") {
							customUpdate["dateString"] = "Starts " + moment().to(customUpdate.start);
						}

						else if (status.type === "current") {
							customUpdate["dateString"] = "Started at " + customUpdate.start.format("h:mm a");
						}
						
						else if (status.type === "recent") {
							customUpdate["dateString"] = "Started at " + customUpdate.start.format("h:mm a");
						}

						/*
						
						else if (status.type === "future") {
							customUpdate["title"] = teamParams.name + " at home, starts at " + gameDate.format("h:mm a");
						}

						*/


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