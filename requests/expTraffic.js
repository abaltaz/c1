var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var EventEmitter = require('events');
var c1functions = require('../core/functions');


var eventType = "traffic";

var trafficRoutes = {
	i90_wb: {
		name: "I-90 Westbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.I-90.I-90+WB",
		roads: ["WB Kennedy Expy", "NB Dan Ryan Expy"],
		roadName: "Outbound Kennedy Expressway",
		showRoadDetail: false
	},
	i90_eb: {
		name: "I-90 Eastbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.I-90.I-90+EB",
		roads: ["EB Kennedy Expy", "SB Dan Ryan Expy"],
		roadName: "Inbound Kennedy Expressway",
		showRoadDetail: false
	},
	danryan_nb: {
		name: "Dan Ryan Northbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.I-90.I-90+WB",
		roads: ["NB Dan Ryan Expy"],
		roadName: "Inbound Dan Ryan",
		showRoadDetail: false
	},
	danryan_sb: {
		name: "Dan Ryan Southbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.I-90.I-90+EB",
		roads: ["SB Dan Ryan Expy"],
		roadName: "Outbound Dan Ryan",
		showRoadDetail: false
	},
	i55_nb: {
		name: "I-55 Northbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.I-55.I-55%20NB",
		roads: ["NB Stevenson Expy"],
		roadName: "Inbound Stevenson Expressway",
		showRoadDetail: false
	},
	i55_sb: {
		name: "I-55 Southbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.I-55.I-55%20SB",
		roadName: "Outbound Stevenson Expressway",
		showRoadDetail: false
	},
	i290_eb: {
		name: "I-290 Eastbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.I-290.I-290%20EB",
		roads: ["EB I-290"],
		roadName: "Inbound Eisenhower Expressway",
		showRoadDetail: false
	},
	i290_wb: {
		name: "I-290 Westbound",
		endpoint: "http://www.travelmidwest.com/lmiga/travelTime.json?path=GATEWAY.IL.I-290.I-290%20WB",
		roads: ["WB I-290"],
		roadName: "Outbound Eisenhower Expressway",
		showRoadDetail: false
	}
};

getExpTrafficInterval();

function getExpTrafficInterval() {
	getExpTraffic().then(function(trafficAlerts) {
		
		console.log("hi");

		if (trafficAlerts.length > 0) {

			trafficAlerts= underscore.sortBy(trafficAlerts);

			var startDate = moment();
			var status = c1functions.determineEventStatus(startDate, startDate, 1);

			var alert = {
				eventType: "traffic",
				description: `Heavy traffic on <ul>${trafficAlerts.join("")}</ul>`,
				title: "Expressway Traffic",
				start: startDate,
				end: startDate,
				inDisplayWindow: status.inDisplayWindow,
				status: status.type,
				statusRank: c1functions.statusOrder.indexOf(status.type),
				eventRank: c1functions.eventOrder.indexOf(eventType),
				slug: c1functions.convertToSlug_withDate('exp-traffic', startDate),
				attribution: "Gateway traffic information courtesy of the Illinois Department of Transportation"
			};

			alert["classNames"] = `${eventType} ${alert.slug}`;
			module.exports.data = [alert];
		}

		else {
			module.exports.data = [];
		}	
		
		setTimeout(getExpTrafficInterval, 300000);

	}).catch(function(err){
		setTimeout(getExpTrafficInterval, 300000);
		console.log("Error with processing traffic. Trying again in 5 minutes.");
	});
};



function getExpTraffic() {

	console.log("getExpTraffic()");

	return new Promise(function(resolve,reject) {

		var trafficAlerts=[];
		trafficRouteIndex = 0;

		//Iterate through each Traffic Route endpoint
		underscore.each(trafficRoutes, function(trafficRoute) {

			//Make the request for each route
			c1functions.doRequest(trafficRoute.endpoint, "json").then(function(route){
				trafficRouteIndex++

				//In the JSON feed from IDOT, select only the roads within Chicago, as specified in trafficRoutes.roads 
				var chicagoExpressways = underscore.filter(route, function(routeData){
					return underscore.contains(trafficRoute.roads, routeData.on);
				});

				var hasTraffic = false;

				//Iterate through each road-segment object in the response from IDOT
				underscore.each(chicagoExpressways, function(expresswaySegment){

					if (hasTraffic === false) {
						if (expresswaySegment.level === "HEAVY_CONGESTION") {
							hasTraffic = true;
							trafficAlerts.push(`<li>${trafficRoute.roadName}</li>`);
							console.log("heavy");
						}
					}

				});

				if (trafficRouteIndex === underscore.size(trafficRoutes)) {
					console.log("resolving trafficAlerts");
					resolve(trafficAlerts);
				}

			}).catch(function(err){
				console.log("Error with Traffic request. Trying again in 5 minutes.", err);
				setTimeout(getExpTrafficInterval, 300000);
			});

		});

	});

}