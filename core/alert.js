

var createAlertString = function(obstacles) {
	
	if (obstacles.length >= 4) {

		var alerts = [];
		var alertsList;
		var alertString;

		underscore.each(obstacles, function(obstacle, index) {

			alerts.push(obstacle.title);

		});

		underscore.each(alerts, function(alert, index) {
			if (index === alerts.length - 1) {
				alertsList = alerts.join(", ");
			}

			if  (index === alerts.length) {
				alertsList = `${alertsList} and ${alert}`
			}

		});

		//alertsList = alerts.join(", "); 

		alertString = `Lots happening in Chicago right now: ${alertsList}`
	}

}