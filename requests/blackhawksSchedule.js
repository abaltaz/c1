var express = require('express');
var router = express.Router();
var moment = require('moment');
var underscore = require('underscore');
var ical2json = require("ical2json");
var EventEmitter = require('events');
var c1functions = require('../core/functions');

var scheduleUrl = "https://www.stanza.co/api/schedules/nhl-blackhawks/nhl-blackhawks.ics";



c1functions.doRequest(scheduleUrl, "otherFileType").then(function(data){

	var scheduleJson = ical2json.convert(data);

	console.log(scheduleJson.VCALENDAR[0].VEVENT);

});