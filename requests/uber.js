var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var Converter = require("csvtojson").Converter;
var request = require('request');
var EventEmitter = require('events');
var c1functions = require('../core/functions');

var eventType = "uber";
var uberPrice = {
  url: 'https://api.uber.com/v1/estimates/price?start_latitude=41.8904&start_longitude=-87.6236&end_latitude=41.9796&end_longitude=-87.6701',
  headers: {
    'Authorization': 'Token kX9EW-r3R12vguxlrUfq8NZ9rqiPMGoQHOJOd9Tc'
  }
};

module.exports = new EventEmitter();

getSurgeInterval();

function getSurgeInterval() {

	getSurge().then(function(data) {
		module.exports.data = data;
		//console.log(data);
		//module.exports.emit('ready');
	});

	setTimeout(getSurgeInterval, 60000);

}

function getSurge() {

	return new Promise(function(resolve, reject) {

		c1functions.doRequest(uberPrice, "json").then(function(data){

			//console.log(data);
			var uberx = underscore.where(data.prices, {localized_display_name: 'uberX'});
			var surgeItem = [];


			if (uberx[0].surge_multiplier > process.env.UBER_SURGE_THRESHOLD) {

				var startDate = moment();

				surgeItem.push({
					eventType: eventType,
					title: "Uber surge in effect",
					description: `Fare increase estimated to be ${uberx[0].surge_multiplier}x`,
					start: startDate,
					end: startDate,
					inDisplayWindow: true,
					status: "current",
					statusRank: c1functions.statusOrder.indexOf("current"),
					eventRank: c1functions.eventOrder.indexOf(eventType),
					slug: c1functions.convertToSlug_withDate("uber-surge", startDate)
				});

				surgeItem[0]["classNames"] = `${eventType} ${surgeItem[0].slug}`;
			}

			resolve(surgeItem);

		});
	});
}




var locations = {
	downtown: {lat: 41.8904, long: -87.6236, name: "Downtown"},
	andersonville: {lat: 41.9796, long: -87.6701, name: "Andersonville"},
	loganSquare: {lat: 41.8904, long: -87.6236, name: "Logan Square"},
	lincolnPark: {lat: 41.9214, long: -87.6513, name: "Lincoln Park"},
	rogersPark: {lat: 42.0106, long: -87.6696, name: "Rogers Park"},
	hydePark: {lat: 41.7943, long: -87.5907, name: "Hyde Park"}
};

var routes = {
	downtownToAndersonville: [locations.downtown, locations.andersonville],
	andersonvilleToDowntown: [locations.andersonville, locations.downtown],
	downtownToLogan: [locations.downtown, locations.loganSquare],
	loganToDowntown: [locations.loganSquare, locations.downtown]
};


/*
getPrices().then(function(data) {
	console.log("prices", data);
});
*/


function getPrices() {

	return new Promise(function(resolve, reject) {

		var prices = [];

		underscore.each(routes, function(route, index) {

			//console.log(`${route[0].lat} - ${route[0].long} - ${route[1].lat} - ${route[1].long}`);

			var priceRequest = {
			  url: `https://api.uber.com/v1/estimates/price?start_latitude=${route[0].lat}&start_longitude=${route[0].long}&end_latitude=${route[1].lat}&end_longitude=${route[1].long}`,
			  headers: {
			    'Authorization': 'Token kX9EW-r3R12vguxlrUfq8NZ9rqiPMGoQHOJOd9Tc'
			  }
			};

			//console.log(priceRequest.url);

			c1functions.doRequest(priceRequest, "json").then(function(data){
				//console.log("uprice", data);

				var uberx = underscore.where(data.prices, {localized_display_name: 'uberX'});

				if (uberx[0].surge_multiplier > process.env.UBER_SURGE_THRESHOLD) {
					prices.push(uberx[0].surge_multiplier);
				}

			});

		});

		setTimeout(function() {

			var sum = 0;

			underscore.each(prices, function(value, index) {
				sum += value;
			});

			var priceAvg = sum / prices.length;

			console.log("prices", prices);
			console.log("pricesum", sum);
			console.log("priceAvg", priceAvg);

			resolve("Price Avg", prices, priceAvg);

		}, 2000);

	});

}
