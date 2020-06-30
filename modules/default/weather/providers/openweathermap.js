/* global WeatherProvider, WeatherObject */

/* Magic Mirror
 * Module: Weather
 *
 * By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 *
 * This class is the blueprint for a weather provider.
 */
WeatherProvider.register("openweathermap", {
	// Set the name of the provider.
	// This isn't strictly necessary, since it will fallback to the provider identifier
	// But for debugging (and future alerts) it would be nice to have the real name.
	providerName: "OpenWeatherMap",

	// Overwrite the fetchCurrentWeather method.
	fetchCurrentWeather() {
		this.fetchData(this.getUrl())
			.then((data) => {
				if (!data || !data.main || typeof data.main.temp === "undefined") {
					// Did not receive usable new data.
					// Maybe this needs a better check?
					return;
				}

				this.setFetchedLocation(`${data.name}, ${data.sys.country}`);

				const currentWeather = this.generateWeatherObjectFromCurrentWeather(data);
				this.setCurrentWeather(currentWeather);
			})
			.catch(function (request) {
				Log.error("Could not load data ... ", request);
			})
			.finally(() => this.updateAvailable());
	},

	// Overwrite the fetchWeatherForecast method.
	fetchWeatherForecast() {
		this.fetchData(this.getUrl())
			.then((data) => {
				if (!data || !data.list || !data.list.length) {
					// Did not receive usable new data.
					// Maybe this needs a better check?
					return;
				}

				this.setFetchedLocation(`${data.city.name}, ${data.city.country}`);

				const forecast = this.generateWeatherObjectsFromForecast(data.list);
				this.setWeatherForecast(forecast);
			})
			.catch(function (request) {
				Log.error("Could not load data ... ", request);
			})
			.finally(() => this.updateAvailable());
	},

	// Overwrite the fetchWeatherData method.
	fetchWeatherData() {
		this.fetchData(this.getUrl())
			.then((data) => {
				if (!data || !data.list || !data.list.length) {
					// Did not receive usable new data.
					// Maybe this needs a better check?
					return;
				}

				this.setFetchedLocation(`${data.lat},${data.lon}`);

				const wData = this.generateWeatherObjectsFromOnecall(data);
				this.setWeatherData(wData);
			})
			.catch(function (request) {
				Log.error("Could not load data ... ", request);
			})
			.finally(() => this.updateAvailable());
	},

	/** OpenWeatherMap Specific Methods - These are not part of the default provider methods */
	/*
	 * Gets the complete url for the request
	 */
	getUrl() {
		return this.config.apiBase + this.config.apiVersion + this.config.weatherEndpoint + this.getParams();
	},

	/*
	 * Generate a WeatherObject based on currentWeatherInformation
	 */
	generateWeatherObjectFromCurrentWeather(currentWeatherData) {
		const currentWeather = new WeatherObject(this.config.units, this.config.tempUnits, this.config.windUnits);

		currentWeather.humidity = currentWeatherData.main.humidity;
		currentWeather.temperature = currentWeatherData.main.temp;
		currentWeather.windSpeed = currentWeatherData.wind.speed;
		currentWeather.windDirection = currentWeatherData.wind.deg;
		currentWeather.weatherType = this.convertWeatherType(currentWeatherData.weather[0].icon);
		currentWeather.sunrise = moment(currentWeatherData.sys.sunrise, "X");
		currentWeather.sunset = moment(currentWeatherData.sys.sunset, "X");

		return currentWeather;
	},

	/*
	 * Generate WeatherObjects based on forecast information
	 */
	generateWeatherObjectsFromForecast(forecasts) {
		if (this.config.weatherEndpoint === "/forecast") {
			return this.fetchForecastHourly(forecasts);
		} else if (this.config.weatherEndpoint === "/forecast/daily") {
			return this.fetchForecastDaily(forecasts);
		}
		// if weatherEndpoint does not match forecast or forecast/daily, what should be returned?
		const days = [new WeatherObject(this.config.units, this.config.tempUnits, this.config.windUnits)];
		return days;
	},

	/*
	 * Generate WeatherObjects based on One Call forecast information
	 */
	generateWeatherObjectsFromOnecall(data) {
		if (this.config.weatherEndpoint === "/onecall") {
			return this.fetchOneCall(data);
		}
		// if weatherEndpoint does not match onecall, what should be returned?
		const wData = {current: new WeatherObject(this.config.units, this.config.tempUnits, this.config.windUnits), hours: [], days: []};
		return wData;
	},

	/*
	 * fetch One Call forecast information (available for free subscription).
	 * factors in timezone offsets.
	 * minutely forecasts are excluded for the moment, see getParams().
	 */
	fetchOnecall(data) {
		let precip = false;
		// get current weather
		const current = new WeatherObject(this.config.units, this.config.tempUnits, this.config.windUnits);
		if (!isNaN(data.current)) {
			current.date = moment(data.current.dt, "X").utcOffset(data.timezone_offset/60);
			current.windSpeed = data.current.wind_speed;
			current.windDirection = data.current.wind_deg;
			current.sunrise = moment(data.current.sunrise, "X").utcOffset(data.timezone_offset/60);
			current.sunset = moment(data.current.sunset, "X").utcOffset(data.timezone_offset/60);
			current.temperature = data.current.temp;
			current.weatherType = this.convertWeatherType(data.current.weather[0].icon);
			current.humidity = data.current.humidity;
			if (current.hasOwnProperty("rain") && !isNaN(current.rain["1h"])) {
				if (this.config.units === "imperial") {
					weather.rain = current.rain["1h"] / 25.4;
				} else {
					weather.rain = current.rain["1h"];
				}
				precip = true;
			}
			if (current.hasOwnProperty("snow") && !isNaN(current.snow["1h"])) {
				if (this.config.units === "imperial") {
					weather.snow = current.snow["1h"] / 25.4;
				} else {
					weather.snow = current.snow["1h"];
				}
				precip = true;
			}
			if (precip) {
				current.precipitation = current.rain+current.snow;
			}
			current.feelsLikeTemp = data.current.feels_like;
		}

		let weather = new WeatherObject(this.config.units, this.config.tempUnits, this.config.windUnits);

		// let onecallDailyFormat = "MMM DD"
		// let onecallHourlyFormat = "HH"
		// let onecallMinutelyFormat = "HH:mm"
		// if (this.config.timeFormat === 12) {
		// 	if (this.config.showPeriod === true) {
		// 		if (this.config.showPeriodUpper === true) {
		// 			onecallHourlyFormat = "hhA"
		// 			onecallMinutelyFormat = "hh:mmA"
		// 		} else {
		// 			onecallHourlyFormat = "hha"
		// 			onecallMinutelyFormat = "hh:mma"
		// 		}
		// 	} else {
		// 		onecallHourlyFormat = "hh"
		// 		onecallMinutelyFormat = "hh:mm"
		// 	}
		// }

		// get hourly weather
		const hours = [];
		if (!isNaN(data.hourly)) {
			for (const hour of data.hourly) {
				weather.date = moment(hour.dt, "X").utcOffset(data.timezone_offset/60);
				// weather.date = moment(hour.dt, "X").utcOffset(data.timezone_offset/60).format(onecallDailyFormat+","+onecallHourlyFormat);
				weather.temperature = hour.temp;
				weather.feelsLikeTemp = hour.feels_like;
				weather.humidity = hour.humidity;
				weather.windSpeed = hour.wind_speed;
				weather.windDirection = hour.wind_deg;
				weather.weatherType = this.convertWeatherType(hour.weather[0].icon);
				precip = false;
				if (hour.hasOwnProperty("rain") && !isNaN(hour.rain["1h"])) {
					if (this.config.units === "imperial") {
						weather.rain = hour.rain["1h"] / 25.4;
					} else {
						weather.rain = hour.rain["1h"];
					}
					precip = true;
				}
				if (hour.hasOwnProperty("snow") && !isNaN(hour.snow["1h"])) {
					if (this.config.units === "imperial") {
						weather.snow = hour.snow["1h"] / 25.4;
					} else {
						weather.snow = hour.snow["1h"];
					}
					precip = true;
				}
				if (precip) {
					weather.precipitation = weather.rain+weather.snow;
				}

				hours.push(weather);
				weather = new WeatherObject(this.config.units, this.config.tempUnits, this.config.windUnits);
			}
		}

		// get daily weather
		const days = [];
		if (!isNaN(data.daily)) {
			for (const day of data.daily) {
				weather.date = moment(day.dt, "X").utcOffset(data.timezone_offset/60);
				weather.sunrise = moment(day.sunrise, "X").utcOffset(data.timezone_offset/60);
				weather.sunset = moment(day.sunset, "X").utcOffset(data.timezone_offset/60);
				// weather.date = moment(day.dt, "X").utcOffset(data.timezone_offset/60).format(onecallDailyFormat);
				// weather.sunrise = moment(day.sunrise, "X").utcOffset(data.timezone_offset/60).format(onecallMinutelyFormat);
				// weather.sunset = moment(day.sunset, "X").utcOffset(data.timezone_offset/60).format(onecallMinutelyFormat);
				weather.minTemperature = day.temp.min;
				weather.maxTemperature = day.temp.max;
				weather.humidity = day.humidity;
				weather.windSpeed = day.wind_speed;
				weather.windDirection = day.wind_deg;
				weather.weatherType = this.convertWeatherType(day.weather[0].icon);
				precip = false;
				if (!isNaN(day.rain)) {
					if (this.config.units === "imperial") {
						weather.rain = day.rain / 25.4;
					} else {
						weather.rain = day.rain;
					}
					precip = true;
				}
				if (!isNaN(day.snow)) {
					if (this.config.units === "imperial") {
						weather.snow = day.snow / 25.4;
					} else {
						weather.snow = day.snow;
					}
					precip = true;
				}
				if (precip) {
					weather.precipitation = weather.rain+weather.snow;
				}

				days.push(weather);
				weather = new WeatherObject(this.config.units, this.config.tempUnits, this.config.windUnits);
			}
		}

		return {current: current, hours: hours, days: days};
	},

	/*
	 * fetch forecast information for 3-hourly forecast (available for free subscription).
	 */
	fetchForecastHourly(forecasts) {
		// initial variable declaration
		const days = [];
		// variables for temperature range and rain
		let minTemp = [];
		let maxTemp = [];
		let rain = 0;
		let snow = 0;
		// variable for date
		let date = "";
		let weather = new WeatherObject(this.config.units, this.config.tempUnits, this.config.windUnits);

		for (const forecast of forecasts) {
			if (date !== moment(forecast.dt, "X").format("YYYY-MM-DD")) {
				// calculate minimum/maximum temperature, specify rain amount
				weather.minTemperature = Math.min.apply(null, minTemp);
				weather.maxTemperature = Math.max.apply(null, maxTemp);
				weather.rain = rain;
				weather.snow = snow;
				weather.precipitation = weather.rain + weather.snow;
				// push weather information to days array
				days.push(weather);
				// create new weather-object
				weather = new WeatherObject(this.config.units, this.config.tempUnits, this.config.windUnits);

				minTemp = [];
				maxTemp = [];
				rain = 0;
				snow = 0;

				// set new date
				date = moment(forecast.dt, "X").format("YYYY-MM-DD");

				// specify date
				weather.date = moment(forecast.dt, "X");

				// If the first value of today is later than 17:00, we have an icon at least!
				weather.weatherType = this.convertWeatherType(forecast.weather[0].icon);
			}

			if (moment(forecast.dt, "X").format("H") >= 8 && moment(forecast.dt, "X").format("H") <= 17) {
				weather.weatherType = this.convertWeatherType(forecast.weather[0].icon);
			}

			// the same day as before
			// add values from forecast to corresponding variables
			minTemp.push(forecast.main.temp_min);
			maxTemp.push(forecast.main.temp_max);

			if (forecast.hasOwnProperty("rain")) {
				if (this.config.units === "imperial" && !isNaN(forecast.rain["3h"])) {
					rain += forecast.rain["3h"] / 25.4;
				} else if (!isNaN(forecast.rain["3h"])) {
					rain += forecast.rain["3h"];
				}
			}

			if (forecast.hasOwnProperty("snow")) {
				if (this.config.units === "imperial" && !isNaN(forecast.snow["3h"])) {
					snow += forecast.snow["3h"] / 25.4;
				} else if (!isNaN(forecast.snow["3h"])) {
					snow += forecast.snow["3h"];
				}
			}
		}

		// last day
		// calculate minimum/maximum temperature, specify rain amount
		weather.minTemperature = Math.min.apply(null, minTemp);
		weather.maxTemperature = Math.max.apply(null, maxTemp);
		weather.rain = rain;
		weather.snow = snow;
		weather.precipitation = weather.rain + weather.snow;
		// push weather information to days array
		days.push(weather);
		return days.slice(1);
	},

	/*
	 * fetch forecast information for daily forecast (available for paid subscription or old apiKey).
	 */
	fetchForecastDaily(forecasts) {
		// initial variable declaration
		const days = [];

		for (const forecast of forecasts) {
			const weather = new WeatherObject(this.config.units, this.config.tempUnits, this.config.windUnits);

			weather.date = moment(forecast.dt, "X");
			weather.minTemperature = forecast.temp.min;
			weather.maxTemperature = forecast.temp.max;
			weather.weatherType = this.convertWeatherType(forecast.weather[0].icon);
			weather.rain = 0;
			weather.snow = 0;

			// forecast.rain not available if amount is zero
			// The API always returns in millimeters
			if (forecast.hasOwnProperty("rain")) {
				if (this.config.units === "imperial" && !isNaN(forecast.rain)) {
					weather.rain = forecast.rain / 25.4;
				} else if (!isNaN(forecast.rain)) {
					weather.rain = forecast.rain;
				}
			}

			// forecast.snow not available if amount is zero
			// The API always returns in millimeters
			if (forecast.hasOwnProperty("snow")) {
				if (this.config.units === "imperial" && !isNaN(forecast.snow)) {
					weather.snow = forecast.snow / 25.4;
				} else if (!isNaN(forecast.snow)) {
					weather.snow = forecast.snow;
				}
			}

			weather.precipitation = weather.rain + weather.snow;

			days.push(weather);
		}

		return days;
	},

	/*
	 * Convert the OpenWeatherMap icons to a more usable name.
	 */
	convertWeatherType(weatherType) {
		const weatherTypes = {
			"01d": "day-sunny",
			"02d": "day-cloudy",
			"03d": "cloudy",
			"04d": "cloudy-windy",
			"09d": "showers",
			"10d": "rain",
			"11d": "thunderstorm",
			"13d": "snow",
			"50d": "fog",
			"01n": "night-clear",
			"02n": "night-cloudy",
			"03n": "night-cloudy",
			"04n": "night-cloudy",
			"09n": "night-showers",
			"10n": "night-rain",
			"11n": "night-thunderstorm",
			"13n": "night-snow",
			"50n": "night-alt-cloudy-windy"
		};

		return weatherTypes.hasOwnProperty(weatherType) ? weatherTypes[weatherType] : null;
	},

	/* getParams(compliments)
	 * Generates an url with api parameters based on the config.
	 *
	 * return String - URL params.
	 */
	getParams() {
		let params = "?";
		if (this.config.weatherEndpoint === "/onecall") {
			params += "lat=" + this.config.lat;
			params += "&lon=" + this.config.lon;
			if (this.config.type === "wDataCurrent") {
				params += "&exclude=minutely,hourly,daily";
			} else if (this.config.type === "wDataHourly") {
				params += "&exclude=current,minutely,daily";
			} else if (this.config.type === "wDataDaily") {
				params += "&exclude=current,minutely,hourly";
			} else {
				params += "&exclude=minutely";
			}
		} else if (this.config.locationID) {
			params += "id=" + this.config.locationID;
		} else if (this.config.location) {
			params += "q=" + this.config.location;
		} else if (this.firstEvent && this.firstEvent.geo) {
			params += "lat=" + this.firstEvent.geo.lat + "&lon=" + this.firstEvent.geo.lon;
		} else if (this.firstEvent && this.firstEvent.location) {
			params += "q=" + this.firstEvent.location;
		} else {
			this.hide(this.config.animationSpeed, { lockString: this.identifier });
			return;
		}

		params += "&units=" + this.config.units;
		params += "&lang=" + this.config.lang;
		params += "&APPID=" + this.config.apiKey;

		return params;
	}
});
