(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-115818-76', 'auto');
ga('set', 'checkProtocolTask', function(){});
ga('send', 'pageview', '/extension.html');

(function(chrome){

	var pollIntervalMin = 1;
	var pollIntervalMax = 60;

	var requestTimeout = 1000 * 4;
	var self = this;
	var defaultLastCount = {
		M: {
			label: 'Mail',
			status: '?'
		},
		F: {
			label: 'Flirts',
			status: '?'
		},
		V: {
			label: 'Visits',
			status: '?'
		},
		L: {
			label: 'Likes',
			status: '?'
		}
	};

	function openTab(url) {
		chrome.permissions.request({
			permissions: ['tabs']
		}, function(granted) {
			if (granted) {
				ga('send', 'event', 'popup', 'url', 'open', 1);
				chrome.tabs.create({
					url: url
				});
				return;
			}
			ga('send', 'event', 'popup', 'url', 'open', 0);
		});
	}


	function loadLastCount() {
		if (!localStorage.hasOwnProperty('lastCount')) {
			return defaultLastCount;
		}
		return JSON.parse(localStorage.lastCount);
	}

	function saveLastCount(lastCount) {
		localStorage.lastCount = JSON.stringify(lastCount);
	}

	function getLastCountText(lastCount) {
		var result = '';
		Object.keys(lastCount).forEach(function(key) {
			result += lastCount[key].status;
		});
		return result;
	}

	function updateIcon() {
		if (!localStorage.hasOwnProperty('lastCount')) {
			chrome.browserAction.setBadgeText({text:"?"});
		} else {
			chrome.browserAction.setBadgeText({
				text: getLastCountText(loadLastCount())
			});
		}
	}

	function onWatchdog() {
		chrome.alarms.get('refresh', function(alarm) {
			if (!alarm) {
				startRequest({scheduleRequest:true, showLoadingAnimation:false});
			}
		});
	}

	function scheduleRequest() {
		var randomness = Math.random() * 2;
		var exponent = Math.pow(2, localStorage.requestFailureCount || 0);
		var multiplier = Math.max(randomness * exponent, 1);
		var delay = Math.min(multiplier * pollIntervalMin, pollIntervalMax);
		delay = Math.round(delay);
		chrome.alarms.create('refresh', {periodInMinutes: delay});
	}

	function getFeedUrl() {
		return 'http://www.happypancake.com/helpforms/GetBulletin.aspx?' + Math.random();
	}

	function fetchStatus(onSuccess, onError) {
		var xhr = new XMLHttpRequest();
		var abortTimerId = window.setTimeout(function() {
			xhr.abort();  // synchronously calls onreadystatechange
		}, requestTimeout);

		function handleSuccess(result) {
			ga('send', 'event', 'feed', 'fetch', 'success');
			localStorage.requestFailureCount = 0;
			window.clearTimeout(abortTimerId);
			if (onSuccess) {
				onSuccess(result);
			}
		}

		var invokedErrorCallback = false;
		function handleError() {
			++localStorage.requestFailureCount;
			ga('send', 'event', 'feed', 'fetch', 'error',
				localStorage.requestFailureCount);
			window.clearTimeout(abortTimerId);
			if (onError && !invokedErrorCallback) {
				onError();
			}
			invokedErrorCallback = true;
		}

		try {
			xhr.onreadystatechange = function() {
				if (xhr.readyState != 4) {
					return;
				}

				if (xhr.responseText) {
					result = JSON.parse(xhr.responseText);
					return handleSuccess(result);
				}
				handleError();
			};

			xhr.onerror = function(error) {
				handleError();
			};

			xhr.open("GET", getFeedUrl(), true);
			xhr.setRequestHeader('Accept', 'application/json, text/javascript');
			xhr.send(null);
		} catch(e) {
			handleError();
		}
	}

	function updateCount(data) {
		var hint = [];
		var lastCount = loadLastCount();
		Object.keys(data).forEach(function(key) {
			if (lastCount.hasOwnProperty(key)) {
				lastCount[key].status = data[key];
				hint.push(lastCount[key].label + ': ' + data[key]);
			}
		});
		saveLastCount(lastCount);
		chrome.browserAction.setTitle({
			title: hint.join("\n")
		});
		updateIcon();
	}

	function startRequest(params) {
		if (params && params.scheduleRequest) {
			scheduleRequest();
		}
		fetchStatus(
			function(data) {
				updateCount(data);
			},
			function() {
				delete localStorage.unreadCount;
				saveLastCount(defaultLastCount);
				updateIcon();
			}
		);
	}

	function onInit() {
		localStorage.requestFailureCount = 0;
		startRequest({scheduleRequest:true, showLoadingAnimation:true});
		chrome.alarms.create('watchdog', {periodInMinutes:5});
	}

	function onAlarm(alarm) {
		if (alarm && alarm.name == 'watchdog') {
			onWatchdog();
		} else {
			startRequest({scheduleRequest:true, showLoadingAnimation:false});
		}
	}
	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		if (request.exec) {
			sendResponse(rpc[request.exec].apply(this, request.args));
		}
	});

	chrome.runtime.onInstalled.addListener(onInit);
	chrome.alarms.onAlarm.addListener(onAlarm);
	chrome.runtime.onStartup.addListener(function() {
		startRequest({scheduleRequest:false, showLoadingAnimation:false});
		updateIcon();
	});
})(chrome || {});
