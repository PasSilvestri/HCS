var http = require("http");
var https = require("https");
var fs = require("fs");
var path = require("path");
var express = require("express");
var webSocket = require("ws");
var bodyParser = require("body-parser");
var fileUpload = require("express-fileupload");
var cors = require('cors');
var postDataParser = require("./PostDataParser");
var deleteFolderRecursive = require("./FileHandler").deleteFolderRecursive;
var pasHtmlEngine = require("./PasHtmlEngine");
var session = require("./beat-session");
var Configuration = require("./Configuration");
var UserFileSystem = require("./UserFileSystem");
var UserManager = require("./user-manager");
//Pass cleanUp = true to the UserManager constructor cause users will be loaded by the configuration
var userManager = new UserManager(true);
var defaultUserData = function (username) {
	var user = {
		username: username, //The unique username
		email: username + "@hcs.com"
	}
	return user;
}
//Setting this function here once and for all. Is the function used to create the default userData object for all the users
userManager.setDefaultUserDataFunction(defaultUserData);

//If there is a second parameter -rc, reconfiguration is required without loosing previous data about the users, lida settings and sessions
var reconfigure = false;
if(process.argv[3] == "-rc"){
	reconfigure = true;
	session.loadSessionsFromFile();
}
//Loading the configuration file
var configContent;
//First test for the provided config file
if (process.argv[2]) {
	let cp = path.normalize(process.argv[2]);
	try {
		if(!path.isAbsolute(cp)){
			cp = path.join(__dirname,cp);
		}
		configContent = fs.readFileSync(cp);
	}
	catch (e) {
		console.log(e);
	}
}
//Then test for the default config file
else if(fs.existsSync(path.join(__dirname,"hcs.config"))){
	try {
		configContent = fs.readFileSync( path.join(__dirname,"hcs.config") );
	}
	catch (e) {
		console.log(e);
	}
}
else{
	console.log("No config file provided. Default configuration used");
}
//No try-catch is used cause any exceptions from the config parsing has to go up the stack and close the program
var configuration = new Configuration(configContent);

//Signup all users
for(let u of configuration.getUserArray()){
	var signupResponse = userManager.signupUser(u.name, u.password, u.name+"@hcs.com");
	if (signupResponse.result != 1) {
		console.error("Internal server error");
	}
	else {
		var resp = userManager.confirmUser(signupResponse.token);
		if (!resp == 1) {
			console.error("Internal server error");
		}
	}
}

var app = express();
var server;
var port;
//If the config has tls support
if(configuration.tls){
	let tlsOptions;
	try{
		tlsOptions = {
			cert: fs.readFileSync(path.normalize(configuration.tls.cert)),
			key: fs.readFileSync(path.normalize(configuration.tls.key))
		}
	}
	catch(e){
		throw "Error reading tls certificate or key";
	}
	server = https.createServer(tlsOptions,app);
	port = configuration.tls.port;
	
	if(configuration.tls.redirect){
		//Creating am http server that redirects to the 
		http.createServer(function (req, res) {
			res.writeHead(301, { "Location": "https://" + req.headers['host'] + ":" + configuration.tlsCert.port + req.url });
			res.end();
		}).listen(configuration.port);
	}
}
else{
	server = http.createServer(app);
	port = configuration.port;
}
var sessionName = "session";

//Set the query parser to "simple" because "extended" bugs with "-" charachters
app.set("query parser","simple");
//View engine
app.engine("html", pasHtmlEngine);
app.set("view engine", "html");
app.set("views", "./server/views");



//Data parsers
//app.use("/upload/file", bodyParser.raw());
postDataParser.clearTempFolder(); //Just to be sure, let's clear the temp folder form the half sent files
app.use(postDataParser());
/*
app.use(fileUpload());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
*/

//Check if the request carries a valid session token, and add it to the request for fast referencing
app.use(session({
	cookieName: sessionName
}));

//CORS options
var corsOption = {
	origin: true,
	methods: "GET,POST",
	preflightContinue: false
}
//Enabling CORS to let external domains use the api
app.use(cors(corsOption));

//Request logger
app.use(function (req, res, next) {
	console.log("");
	console.log(req.method + " request from: " + req.connection.remoteAddress + " request: " + req.originalUrl);
	console.log("----------------");

	next();
});

// Static resources
var staticOptions = {
	maxage: "1d",
	maxAge: "1d",
	etag: true,
	lastModified: true,
	cacheControl: true,
	fallthrough: true,
};
app.use("/img", express.static("server/res/img/", staticOptions));
app.use(express.static("server/res"));


// Routes
app.get("/", function (req, res) {
	if (req[sessionName] != undefined && req[sessionName].logged == true) {
		res.render("index", { username: req[sessionName].username });
	}
	else {
		res.redirect("login");
	}
});
app.post("/", function (req, res) {
	//HTTP:405 method not allowed
	res.sendStatus(405);
});


app.get("/login", function (req, res) {
	if (req[sessionName] != undefined && req[sessionName].logged == true) {
		console.log("Redirecting to /");
		res.redirect("/");
	}
	else {
		res.render("login");
	}
});
app.post("/login", function (req, res) {
	console.log("POST login request");
	if (req[sessionName] == undefined && userManager.authUser(req.body.username, req.body.password)) {
		console.log("Access granted to " + req.body.username);
		var options = {
			cookieName: sessionName,
			maxAge: (req.body.rememberMe == "true" ? (60 * 60 * 24 * 365 * 5) : (60 * 60 * 10)) // 5 years if rememberMe is checked, 10 hours otherwise
		};
		req = session.createSession(req, res, options);
		req = session.setSessionData(req, "logged", true);
		req = session.setSessionData(req, "username", req.body.username);
		res.send("Access granted");
	}
	else {
		console.log("Access denied to " + req.body.username);
		res.send("Access denied");
	}
});



app.get("/logout", function (req, res) {
	session.destroySession(req, res);
	res.redirect("login");
});
app.post("/logout", function (req, res) {
	session.destroySession(req, res);
	res.redirect("login");
});

//Routes that handles all file operations
app.get("/files",function(req,res){
	if (req[sessionName] != undefined && req[sessionName].logged == true) {
		//Send 541 "Path required" if no path query was sent
		if(!req.query.path){
			res.status(541).end("Path required");
			return;
		}
		//Recover the user's data and file system instance, or create one if dosen't exists
		let username = req[sessionName].username;
		let userData = userManager.getUserData(username,true);
		let ufs = getUserFileSystemFromUserData(userData,req[sessionName]);
		//Finding what request it was
		switch(req.query.req){
			case "stat":
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				ufs.stat(req.query.path,(err,stat) => {
					if(err) {
						res.sendStatus(404);
					}
					else {
						res.end(JSON.stringify(stat));
					}
				});
				return;
			case "createfolder":
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				ufs.createFolder(req.query.path,(err) => {
					res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
					if(err) {
						res.status(544).end("Cannot create folder");
					}
					else {
						res.sendStatus(200);

						//Updating all clients through websocket
						webSocketBroadcast(username,req[sessionName].id,"createfolder",req.query.path);
					}
				});
				return;
			case "move":
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				ufs.moveFile(req.query.path,req.query.newpath,(err)=>{
					if(err){
						res.sendStatus(500);
					}
					else{
						res.sendStatus(200);

						//Updating all clients through websocket
						webSocketBroadcast(username,req[sessionName].id,"move",[req.query.path,req.query.newpath]);
					}
				});
				return;
			case "copy":
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				ufs.copyFile(req.query.path,req.query.newpath,(err)=>{
					if(err){
						res.sendStatus(500);
					}
					else{
						res.sendStatus(200);

						//Updating all clients through websocket
						webSocketBroadcast(username,req[sessionName].id,"copy",req.query.newpath);
					}
				});
				return;
			case "changefolder":
				var res;
				try{
					resp = ufs.setCurrentHcsFolder(req.query.path);
					res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
					resp ? res.status(200).send(ufs.getCurrentHcsFolder()) : res.status(404).send(ufs.getCurrentHcsFolder());
				}
				catch(err){
					res.status(542).end("Folder path required");
				}
				return;
			case "calcfoldersize":
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				ufs.calculateFolderSize(req.query.path,true,function(err,size){
					if(err) {
						res.status(500).send(err.toString());
					}
					else {
						res.status(200).send(size.toString());
					}
				});
				return;
			case "rootfolderlist":
				let obj = {
					selected: ufs.getCurrentRootFolder(),
					list: ufs.getRootFolderNames()
				};
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				res.status(200).send(JSON.stringify(obj));
				return;
			case "trashfolder":
				let trash = ufs.getTrashFolder(req.query.path);
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				res.send(JSON.stringify(trash));
				return;
			case "delete":
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				ufs.deleteFile(req.query.path,function(err){
					if(err) {
						res.status(500).send(err.toString());
					}
					else {
						res.sendStatus(200);

						//Updating all clients through websocket
						webSocketBroadcast(username,req[sessionName].id,"delete",req.query.path);
					}
				});
				return;
			case "publicsharefolderinfo":
				let pShareFolder = ufs.getPublicShareFolder(req.query.path);
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				res.send(JSON.stringify(pShareFolder));
				return;
			case "linksharefolderinfo":
				let lShareFolder = ufs.getLinkShareFolder(req.query.path);
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				res.send(JSON.stringify(lShareFolder));
				return;
			case "publicsharefile":
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				//Check if the path exists
				var stat;
				try{
					stat = ufs.statSync(req.query.path);
				}
				catch(err){
					res.sendStatus(404);
					return;
				}
				//If the path exists deliver what was requested
				ufs.shareFile(req.query.path,1, function(err){
					if(err){
						res.status(500).send(err.name);
					}
					else{
						res.sendStatus(200);

						//Updating all clients through websocket
						webSocketBroadcast(username,req[sessionName].id,"publicsharefile",req.query.path);
					}
				});
				return;
			case "linksharefile":
				res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
				//Check if the path exists
				var stat;
				try {
					stat = ufs.statSync(req.query.path);
				}
				catch (err) {
					res.sendStatus(404);
					return;
				}
				//If the path exists deliver what was requested
				if (stat.isFile) {
					ufs.shareFile(req.query.path, 2, function (err,link) {
						if (err) {
							res.status(500).send(err.name);
						}
						else {
							res.status(200).send(link);
							
							//Updating all clients through websocket
							webSocketBroadcast(username,req[sessionName].id,"linksharefile",req.query.path);
						}
					});
				}
				else {
					res.status(543).send("File path required");
				}
				return;
			case "file":
				res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
				//Check if the path exists
				var stat;
				try{
					stat = ufs.statSync(req.query.path);
				}
				catch(err){
					res.sendStatus(404);
					return;
				}
				//If the path exists deliver what was requested
				if(stat.isFile){
					//Set the filename in the content-disposition header
					res.setHeader("Content-Disposition",`filename="${req.query.path.substr(req.query.path.lastIndexOf("/")+1)}"`);
					res.sendFile(ufs.getMachinePath(req.query.path));
				}
				else{
					res.status(543).send("File path required");
				}
				return;
			case "filetree":
				//Set the cache-control so that the browser doesn't cache the response
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				//Check if the path exists
				var stat;
				try{
					stat = ufs.statSync(req.query.path);
				}
				catch(err){
					res.sendStatus(404);
					return;
				}
				//If the path exists deliver what was requested
				if(stat.isDirectory){
					var fileTree;
					try{
						fileTree = ufs.getFileTree(req.query.level,ufs.getMachinePath(req.query.path));
						res.send(JSON.stringify(fileTree));
					}
					catch(err){
						//Check what error was and send the appropriate response (look the code of the error inside UserFileSystem.js)
						if(err.errorNumber == 2){
							res.sendStatus(404);
						}
						else{
							res.sendStatus(500);
						}
					}
				}
				else{
					res.status(542).send("Folder path required");
				}
				return;
			case "search":
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				//Check if the path exists
				var stat;
				try{
					stat = ufs.statSync(req.query.path);
				}
				catch(err){
					res.sendStatus(404);
					return;
				}
				//If the path exists deliver what was requested
				if(stat.isDirectory){
					var fileTree;
					try{
						fileTree = ufs.getSearchFileTree(req.query.match,ufs.getMachinePath(req.query.path));
						res.send(JSON.stringify(fileTree));
					}
					catch(err){
						//Check what error was and send the appropriate response (look the code of the error inside UserFileSystem.js)
						if(err.errorNumber == 2){
							res.sendStatus(404);
						}
						else{
							res.sendStatus(500);
						}
					}
				}
				else{
					res.status(542).send("Folder path required");
				}
				return;
			//Default error 400
			default:
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				res.sendStatus(400);
				return;
		}
	}
	else {
		res.send("Need to login");
	}
	
});
app.post("/files",function(req,res){
	if (req[sessionName] == undefined || req[sessionName].logged != true) {
		res.send("Need to login");
		return;
	}
	//Send 545 "File required" if no file was sent, without doing any additional useless work
	if(!req.files.files){
		res.status(545).end("File required");
		return;
	}

	//Recover the user's data and file system instance, or create one if dosen't exists
	let username = req[sessionName].username;
	let userData = userManager.getUserData(username,true);
	let ufs = getUserFileSystemFromUserData(userData,req[sessionName]);

	
	let pathString = req.body.path || ufs.getCurrentHcsFolder();

	if(ufs.existsSync(pathString,true)){
		if(!(req.files.files instanceof Array)){
			req.files.files = [req.files.files];
		}
		var fileIndex = 0;
		for(let file of req.files.files){
			console.log(`${username} is writing file: ${ufs.resolve(pathString+"/"+file.name,true)}`);
			ufsPath = ufs.getMachinePath(pathString+"/"+file.name);
			//Let's call move to put them from the PostDataParser temp folder to the right folder
			file.move(ufsPath,(err)=> {
				if(err){
					res.sendStatus(500);
					fileIndex = -1;
					return;
				}
				if(fileIndex > -1) fileIndex++;
				if(fileIndex >= req.files.files.length){
					res.status(200).send(ufs.parse(pathString+"/"+req.files.files[0].name,true));
					
					//Updating all clients through websocket
					webSocketBroadcast(username,req[sessionName].id,"upload",ufs.resolve(pathString,true));
				}
			});
		}
	}
	else{
		res.sendStatus(404);
	}
});

app.get("/linkshare",function(req,res){
	let username = req.query.user;
	let root = req.query.root;
	let ino = req.query.token;
	
	if(!username || !root || !ino){
		res.sendFile(path.join(__dirname, "server", "views", "error404.html"));
		return;
	}
	
	let userData = userManager.getUserData(username,true);
	let ufs = getUserFileSystemFromUserData(userData);
	let database = ufs.getCorrespondingDatabase(root);
	let fileTable = database.getTable("file","ino");
	let infoObj = fileTable.get(ino, "ino");
	let filename = infoObj.path.substring(infoObj.path.lastIndexOf("/")+1);
	if(filename.trim() == ""){
		filename = "Unknown";
	}

	if(infoObj.linkShared && fs.existsSync(infoObj.linkSharePath)){
		res.set('Content-Disposition', `inline; filename="${filename}"`);
		res.sendFile(infoObj.linkSharePath);
	}
	else{
		res.sendFile(path.join(__dirname, "server", "views", "error404.html"));
	}
});


// app.get("/coin",function(req,res){
// 	let x = Math.round(Math.random());
// 	if(x==0){
// 		res.send("test");
// 		console.log("testa");
// 	}
// 	else{
// 		res.send("croce");
// 		console.log("croce");
// 	}
// });


// If express gets to this point, means it hasn't found anything to handle the request
app.use(function (req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// If our applicatione encounters an error, we'll display the error and stacktrace accordingly.
app.use(function (err, req, res, next) {
	res.status(err.status || 500);

	if (err.status == 404) {
		res.sendFile(path.join(__dirname, "server", "views", "error404.html"));
	}
	else {
		res.send(err.toString());
	}
	
	console.log(`Sent ${err.status || 500} to ${req.connection.remoteAddress}`);
});


server.listen(port, function () {
	console.log("Server started on port " + port);
})

//WEBSOCKET SECTION

var wsServer = new webSocket.Server({
	server: server,
	clientTracking: true,
	verifyClient: isUserAuth
});

//A dictionary of arrays of user web sockets
var usersRooms = {};
//When a user connects to this server
wsServer.on("connection",function(userWS, req){
	//Retrieving the session for this user and saving them inside his websocket
	req = session.retrieveSessionFromCookie(req,undefined,sessionName);
	//saving the session in the websocket
	userWS[sessionName] = req[sessionName];
	let userSession = req[sessionName];
	//Saving the websocket in the session
	userSession.webSocket = userWS;
	//Setting up the emit function
	userWS.sendEvent = generalSendEvent.bind(userWS);

	//Create the array of clients for this user
	if(!usersRooms[userSession.username]){
		usersRooms[userSession.username] = [];
	}
	//And then add the websocket to it
	usersRooms[userSession.username].push(userWS);

	userWS.on('close', function() {
		usersRooms[userSession.username].splice(usersRooms[userSession.username].indexOf(userWS),1);
	});
	userWS.on("error",(err) => console.log('WebSocket error: ' + err));
});
wsServer.on("error",(err) => console.log('WebSocket error: ' + err));

function generalSendEvent(event, data){
	let wres = {
		req: event,
		data: data
	}
	let message = JSON.stringify(wres);
	this.send(message);
}

function webSocketBroadcast(username, sessionToken, event, data){
	let wres = {
		req: event,
		data: data
	}
	let message = JSON.stringify(wres);
	let room = usersRooms[username];
	if(!room) return;
	for(let userWS of room){
		//if this websocket has sessionToken as a token, skip this websocket, so the message isn't sent back to the sender
		if(userWS[sessionName].id == sessionToken){
			continue;
		}
		userWS.send(message);
	}
}

//Checks if user's session ID is valid
//info can be both an http request or a websocket info object{origin {String} = Origin header, req = the client HTTP GET request, secure {Boolean} = true if req.connection.authorized or req.connection.encrypted is set.}
function isUserAuth(info){
	var sessionData = {};
	var req;
	//Info is an http req
	if(info.method != undefined){
		req = info;
	}
	//Info is the websocket info object
	else if(info.req.method != undefined){
		req = info.req;
	}
	
	req = session.retrieveSessionFromCookie(req,undefined,sessionName);
	sessionData = req[sessionName];
	
	//If there is no session, or logged == false, not logged
	if(sessionData != undefined && sessionData.logged == true){
		return true;
	}
	return false;
}


function getUserFileSystemFromUserData(userData, userSession = {}){
	//If the session already has a ufs, return it
	if(userSession.ufs){
		return userSession.ufs;
	}
	//Otherwise, take it from memory
	//If there is no ufs stored, create it
	else if(!userData.ufs){
		userData.ufs = new UserFileSystem(userData.username,configuration.getRootFolderArray());
		userSession.ufs = userData.ufs;
	}
	//If there is one, but is not instanceof UserFileSystem means is a backup copy, refresh it
	else if(!(userData.ufs instanceof UserFileSystem)){
		userData.ufs = UserFileSystem.createFromBackupObject(userData.ufs);
		userSession.ufs = userData.ufs;
	}
	//If there is a ufs in memory, clone it, put the clone in the session data and return it
	else{
		userSession.ufs = UserFileSystem.cloneUserFileSystem(userData.ufs);
	}
	return userSession.ufs;
}
