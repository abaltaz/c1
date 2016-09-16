var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var EventEmitter = require('events');
var c1functions = require('../core/functions');


var eventType = "traffic";

var trafficRoutes = {
	lsd_nb: {
		name: "Lake Shore Drive Northbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.LAKESHORE.LAKE%20SHORE%20DRIVE%20NB",
		roads: ["NB Lake Shore Drive"],
		roadName: "Northbound Lake Shore Drive",
		showRoadDetail: true
	},
	lsd_sb: {
		name: "Lake Shore Drive Southbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.LAKESHORE.LAKE%20SHORE%20DRIVE%20SB",
		roads: ["SB Lake Shore Drive"],
		roadName: "Southbound Lake Shore Drive",
		showRoadDetail: true
	}
};

getTrafficInterval();

function getTrafficInterval() {
	getTraffic().then(function(data) {
		module.exports.data = data;
		setTimeout(getTrafficInterval, 300000);
	}).catch(function(err){
		setTimeout(getTrafficInterval, 300000);
		console.log("Error with processing traffic. Trying again in 5 minutes.");
	});
};



function getTraffic() {

	console.log("getTraffic()");

	return new Promise(function(resolve,reject) {

		var lsd_trafficAlerts=[];
		var expressway_trafficAlerts=[];

		//Iterate through each Traffic Route endpoint
		underscore.each(trafficRoutes, function(routeMeta, index) {

			var validRoads;

			//Make the request for each route
			c1functions.doRequest(routeMeta.endpoint, "json").then(function(route){


				//In the JSON feed from IDOT, select only the roads within Chicago, as specified in trafficRoutes.roads 
				validRoads = underscore.filter(route, function(routeData){
					return underscore.contains(routeMeta.roads, routeData.on);
				});


				//console.log("validRoads", validRoads);

				//Array containing html strings for each traffic alert item
				var segmentAlertsHtml = [];

				//Iterate through each road-segment object in the response from IDOT
				underscore.each(validRoads, function(roadSegment){

					//Store an object as a string if the road is congested
					if (roadSegment.level === "HEAVY_CONGESTION") {
						segmentAlertsHtml.push(`${roadSegment.to}`);
					}

					/*
					else if (roadSegment.level === "MEDIUM_CONGESTION") {
						segmentAlertsHtml.push(`<li>Moderate traffic near ${roadSegment.to}</li>`);
					}
					*/

				});

				if (segmentAlertsHtml.length > 0) {

					var description;

					

					//If only 1 item in the traffic alerts array, remove the <li> elements
					if (segmentAlertsHtml.length === 1 && routeMeta.showRoadDetail === true) {
						description = `Traffic near: ${segmentAlertsHtml[0]}`;
					}

					//Otherwise, add <ul> around the list elements
					else if (segmentAlertsHtml.length > 1 && routeMeta.showRoadDetail === true) {

						var roadLocationList = [];

						underscore.each(segmentAlertsHtml, function(roadLocation, index) {
							roadLocationList.push(`<li>${roadLocation}</li>`);
						});

						description = `Traffic near <ul>${roadLocationList.join("")}</ul>`;
						//description = description.replace(/\,\s/, " and ");
					}

					else if (segmentAlertsHtml.length >= 1 && routeMeta.showRoadDetail === false) {
						description = `Traffic on ${routeMeta.roadName}`;
					}

					var startDate = moment();

					var status = c1functions.determineEventStatus(startDate, startDate, 1);


					var alert = {
						eventType: "traffic",
						description: description,
						title: routeMeta.name,
						start: startDate,
						end: startDate,
						inDisplayWindow: status.inDisplayWindow,
						status: status.type,
						statusRank: c1functions.statusOrder.indexOf(status.type),
						eventRank: c1functions.eventOrder.indexOf(eventType),
						slug: c1functions.convertToSlug_withDate(routeMeta.name, startDate),
						attribution: "Gateway traffic information courtesy of the Illinois Department of Transportation"
					};

					
					alert["classNames"] = `${eventType} ${c1functions.convertToSlug(routeMeta.name)} ${alert.slug}`;

					lsd_trafficAlerts.push(alert);
				}

			}).catch(function(err){
				console.log("Error with Traffic request. Trying again in 5 minutes.", err)
			});

		});

		//Need to figure out how to structure this Promise without a setTimeout
		setTimeout(function() {
			
			resolve(lsd_trafficAlerts);

		},100);

	});

}