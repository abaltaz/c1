var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var EventEmitter = require('events');
var c1functions = require('../core/functions');



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

getTrafficInterval();

function getTrafficInterval() {
	getTraffic().then(function(data) {
		module.exports.data = data;
	});

	setTimeout(getTrafficInterval, 300000);

};

function getTraffic() {

	return new Promise(function(resolve,reject) {

		var trafficAlerts=[];

		//Iterate through each Traffic Route endpoint
		underscore.each(trafficRoutes, function(route, index) {

			//Make the request for each route
			c1functions.doRequest(route.endpoint, "json").then(function(road){

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

					
					var description = "<ul>" + segmentAlertsHtml.join("") + "</ul>";
					var startDate = moment();

					var status = c1functions.determineEventStatus(startDate, startDate, 1);

					var alert = {
						description: description,
						title: "Heavy traffic on " + route.name,
						start: startDate,
						end: startDate,
						inDisplayWindow: status.inDisplayWindow,
						status: status.type,
						statusRank: c1functions.statusOrder.indexOf(status.type),
						slug: c1functions.convertToSlug_withDate(route.name, startDate)
					};


					
					alert["classNames"] = "traffic " + alert.slug;

					trafficAlerts.push(alert);
				}

			});

		});

		//Need to figure out how to structure this Promise without a setTimeout
		setTimeout(function() {
			
			resolve(trafficAlerts);
		},100);

	});

}