var cookie = require("cookie");
var bcrypt = require("bcryptjs");
var fs = require("fs");
var path = require("path");
var setLongTimeout = function(callback,time){
	var maxTime = Math.pow(2,31)-1;

	var args = Array.from(arguments);
	args.splice(0,2);

	var count = time/maxTime;
	if(count <= 1){
		setTimeout(callback,time,...args);
		return;
	}

	var recursiveFun = function(count){
		if(count > 1){
			setTimeout(recursiveFun,maxTime,count-1);
		}
		else{
			setTimeout(callback,maxTime*count,...args);
		}
	}
	setTimeout(recursiveFun,maxTime,count-1);
}

var cookieName = "session";
var savedSessionFilePath = path.join(__dirname,"data","session-data","BeatSessionBackup.json");
var sessionList = {};
// Save the sessionList every 30 minutes to file
let timedFileSave = function(time){
	saveSessionsToFile();
	setTimeout(timedFileSave,time,time);
}
timedFileSave(1000*60*30);

function genUniqueID(){
	return 'ses-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * This is the actual middleware, with the standard operation of a middleware, like calling next()
 * @param {Object} options - Object containing options. Options are "cookieName" with the given to the session
 */
var sessionFactory = function(options){
	return function(req, res, next){
		cookieName = options.cookieName || cookieName;
		req = retrieveSessionFromCookie(req,res,options.cookieName || cookieName);
		next();
	}
}

//Option is the same option object the cookie module require + cookieName (https://www.npmjs.com/package/cookie)
var createSession = function(req,res,options){
	var ID = genUniqueID(); //Gen the ID for the session
	//Save the session server side
	sessionList[ID] = {id: ID, cookieName: options.cookieName || cookieName};
	//Set the ID client side to retrieve the session on every request
	var cookieValue = cookie.serialize(options.cookieName || cookieName,ID,options); 
	res.setHeader("set-cookie", cookieValue); 
	//Set the expiration timeout for the session (maxAge is in seconds, timeouts are in ms)
	//The normal setTimeout can use times up to the max value of signed 32bit integer, setLongTimeout is a more powerfull custom versione
	setLongTimeout(destroySession,options.maxAge*1000,req,undefined,options.cookieName || cookieName);
	// Save the time remaining from expiration in milliseconds
	sessionList[ID].expirationTime = (new Date().getTime()) + options.maxAge*1000;
	//Update the session param inside the request
	req[options.cookieName] = sessionList[ID];
	//Saving
	return req;
}

//Destroys the session named = cookieName, delete the cookie from the client and reset req
var destroySession = function(req,res,cookieNamePassed){
	cookieNamePassed = cookieNamePassed || cookieName;
	//Retrieve the sessionID and delete it from the server sessions
	if(req[cookieNamePassed] != undefined){
		var sessionID = req[cookieNamePassed].id;
		delete sessionList[sessionID];
	}
	
	//Delete the session cookie from the client
	if(res != undefined){
		var cookieValue = cookie.serialize(cookieNamePassed,"Logged Out",{maxAge: 10});
		res.setHeader("set-cookie", cookieValue);
		req[cookieNamePassed] = undefined;
	}
	return req;
}

//Destroys internally the session with a specific ID
var destroyInternalSession = function(ID){
	delete sessionList[ID];
}

/**
 * Retrieve the session from the cookies if present and puts it in the req object
 * @param {HTTPRequest} req - The HTTP request made to the server
 * @param {HTTPResponse} res - The HTTPResponse of the server
 * @param {String} [cookieNamePassed] - The name of the cookie holding the session token. Is optional cause it can be set once in the middleware
 * @returns {HTTPRequest} - The HTTP request made to the server with the session parameted inside, to access it use as property name "cookieNamePassed"
 */
function retrieveSessionFromCookie(req, res, cookieNamePassed){
	cookieNamePassed = cookieNamePassed || cookieName;
	var cookies = cookie.parse(req.headers.cookie || "");
	//Check if there is the session cookie is present
	if(cookies[cookieNamePassed] != undefined && cookies[cookieNamePassed] != "Logged Out"){
		var sessionID = cookies[cookieNamePassed];
		//If the session with that specific ID exists than put the session inside the req
		if(sessionList[sessionID] != undefined){
			//A param called like the cookie will be created, is an object from the sessionList
			req[cookieNamePassed] = sessionList[sessionID];
		}
		//If the client has sent an id but it's not present on the server token list, destroy the session
		else{
			destroySession(req,res,cookieNamePassed);
		}
	}
	return req;
}

/**
 * Get the session object from a parsed cookie object instead of a request
 * @param {Object} cookies - The parsed cookie object of am HTTPRequest
 * @param {Boolean} parse - True if cookies need to be parsed
 * @param {String} [cookieNamePassed] - The name of the cookie holding the session token. Is optional cause it can be set once in the middleware
 * @returns {Object} - The session object with the informations saved into it 
 */
function getRawSession(cookies,parse,cookieNamePassed){
	if(parse){
		cookies = cookie.parse(cookies || "");
	}
	cookieNamePassed = cookieNamePassed || cookieName;
	//Check if there is the session cookie is present
	if(cookies[cookieNamePassed] != undefined && cookies[cookieNamePassed] != "Logged Out"){
		var sessionID = cookies[cookieNamePassed];
		//If the session with that specific ID exists than put the session inside the req
		if(sessionList[sessionID] != undefined){
			//A param called like the cookie will be created, is an object from the sessionList
			return sessionList[sessionID];
		}
	}
}

function setSessionData(req,param,value,cookieNamePassed){
	cookieNamePassed = cookieNamePassed || cookieName;
	if(req[cookieNamePassed] != undefined){
		var sessionID = req[cookieNamePassed].id;
		//If the session with that specific ID exists than put the data inside the session, and the session inside the req
		if(sessionList[sessionID] != undefined){
			//Update the server session data and the pass it to the req object
			sessionList[sessionID][param] = value;
			req[cookieNamePassed] = sessionList[sessionID];
		}
	}
	else {
		throw new Error("No session in this request");
	}
	return req;
}

function refreshSession(req,res,cookieNamePassed){
	var cookieValue = cookie.serialize(cookieNamePassed,req[cookieNamePassed].id,{maxAge: 10});
	res.setHeader("set-cookie", cookieValue);
}

function saveSessionsToFile(){
	var jsonSessions = "{}";
	try{
		jsonSessions = JSON.stringify(sessionList);
	}
	catch(err){
		jsonSessions = "{}";
	}
	fs.writeFile(savedSessionFilePath,jsonSessions, (err) => {
		if(err)
			console.log("Error saving sessions to file " + err);
	});
}

function loadSessionsFromFile(){
	try{
		let jsonSessionList = fs.readFileSync(savedSessionFilePath).toString();
		sessionList = JSON.parse(jsonSessionList);
		let keys = Object.keys(sessionList)
		for(let i=0; i<keys.length; i++){
			let key = keys[i];
			// Calculate the remaning time for this session and simulate the original destroySession timeout if the session is still alive
			let maxAge = sessionList[key].expirationTime - (new Date().getTime());
			if(maxAge > 0){
				setLongTimeout(destroyInternalSession, maxAge, sessionList[key].id);
			}
			else{
				delete sessionList[key];
			}
		}
	}
	catch(err){
		console.log("Error loading session from file " + err);
	}
}

module.exports = sessionFactory;
module.exports.createSession = createSession;
module.exports.destroySession = destroySession;
module.exports.retrieveSessionFromCookie = retrieveSessionFromCookie;
module.exports.setSessionData = setSessionData;
module.exports.getRawSession = getRawSession;
module.exports.loadSessionsFromFile = loadSessionsFromFile;