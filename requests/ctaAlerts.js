var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var parseString = require('xml2js').parseString;
var EventEmitter = require('events');
var c1functions = require('../core/functions');


var ctaAlertsEndpoint =  "http://www.transitchicago.com/api/1.0/alerts.aspx?routeid=red,blue,org,brn,g,pexp";

getCtaInterval();

function getCtaInterval() {

	getCtaStatus().then(function(data) {
		module.exports.data = data;
		setTimeout(getCtaInterval, 300000);
	}).catch(function(err){
		console.log(err, "Error in getCtaStatus()");
		setTimeout(getCtaInterval, 300000);
	});

}

function getCtaStatus() {
	return new Promise(function(resolve,reject) {

		console.log("getCtaStatus()");

		c1functions.doRequest(ctaAlertsEndpoint, "xml").then(function(data){

			if (data == Error) {
				reject(new Error("Bad response from CTA endpoint"));
			}

			else {

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

							var status = c1functions.determineEventStatus(alertStart, alertEnd, 2);

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
									slug: c1functions.convertToSlug_withDate(alert.Headline[0], alertStart)
								};

								majorAlert["classNames"] = "cta transit " + majorAlert.slug;

								if (now.isBefore(alertStart)) {
									majorAlert["dateString"] = "Starts at " + alertStart.format("h:mm a")
								}

								else if (now.isSame(alertEnd, "day") && alertStart !== alertEnd) {
									majorAlert["dateString"] = "Ends at " + alertEnd.format("h:mm a [today]");
								}

								else if (alertStart !== alertEnd) {
									majorAlert["dateString"] = "Ends on " + alertEnd.format("MMMM D [at] h:mm a");
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
			}
		}).catch(function(err){
			console.log("Error with CTA request. Trying again in 5 minutes.", err);
			setTimeout(getCtaInterval, 300000);
		});
	});
}