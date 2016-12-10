var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var ical2json = require("ical2json");
var EventEmitter = require('events');
var c1functions = require('../core/functions');

var blackhawksScheduleUrl = "https://www.stanza.co/api/schedules/nhl-blackhawks/nhl-blackhawks.ics";
var bullsScheduleUrl = "https://www.stanza.co/api/schedules/nba-bulls/nba-bulls.ics"


var bullsParams = {
	name: "Bulls",
	schedule: "https://www.stanza.co/api/schedules/nba-bulls/nba-bulls.ics"
}

var blackhawksParams = {
	name: "Blackhawks",
	schedule: "https://www.stanza.co/api/schedules/nhl-blackhawks/nhl-blackhawks.ics"
}


function getSchedule(teamParams) {

	c1functions.doRequest(teamParams.schedule, "otherFileType").then(function(data){

		var scheduleJson = ical2json.convert(data);

		underscore.each(scheduleJson.VCALENDAR[0].VEVENT, function(game, index) {

			var start = moment(game.DTSTART).utcOffset(-600);
			
			//20161028T000000Z

			console.log(start.format("MM/DD/YY HH:mma"));
		});

	});

}

getSchedule(bullsParams);