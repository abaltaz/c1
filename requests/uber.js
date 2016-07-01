var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var Converter = require("csvtojson").Converter;
var request = require('request');
var EventEmitter = require('events');
var c1functions = require('../core/functions');


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
		module.exports.emit('ready');
	});

	setTimeout(getSurgeInterval, 300000);

}

function getSurge() {

	return new Promise(function(resolve, reject) {

		c1functions.doRequest(uberPrice, "json").then(function(prices){

			var uberx = underscore.where(prices.prices, {localized_display_name: 'uberX'});

			if (uberx[0].surge_multiplier > 1) {

				var startDate = moment();

				var surgeItem = [{
					title: "Uber surge in effect",
					description: `Fare increase estimated to be ${uberx[0].surge_multiplier}x`,
					start: startDate,
					end: startDate,
					inDisplayWindow: true,
					status: "current",
					statusRank: 0,
					slug: c1functions.convertToSlug_withDate("uber surge", startDate)
				}];

				surgeItem[0]["classNames"] = "uber " + surgeItem[0].slug;

				resolve(surgeItem);

			}

		});
	});
}