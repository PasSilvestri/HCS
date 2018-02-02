var http = require("http");
var https = require("https");
var fs = require("fs");
var path = require("path");
var express = require("express");
var SocketIo = require("socket.io");
var bodyParser = require("body-parser");
var fileUpload = require("express-fileupload");
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
	session.loadSessionFromFile();
}
//Loading the configuration file
var configContent;
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
var io = SocketIo(server);
var sessionName = "session";

//Set the query parser to "simple" because "extended" bugs with "-" charachters
app.set("query parser","simple");
//View engine
app.engine("html", pasHtmlEngine);
app.set("view engine", "html");
app.set("views", "./server/views");


//Data parsers
//app.use("/upload/file", bodyParser.raw());
app.use(fileUpload());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//Check if the request carries a valid session token, and add it to the request for fast referencing
app.use(session({
	cookieName: sessionName
}));

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
		let ufs = getUserFileSystemFromUserData(userData);
		//Finding what request it was
		switch(req.query.req){
			case "stat":
				ufs.stat(req.query.path,(err,stat) => {
					res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
					if(err) 
						res.sendStatus(404);
					else
						res.end(JSON.stringify(stat));
				});
				return;
			case "createfolder":
				ufs.createFolder(req.query.path,(err) => {
					res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
					if(err) 
						res.status(544).end("Cannot create folder");
					else 
						res.sendStatus(200);
				});
				return;
			case "move":
				ufs.moveFile(req.query.path,req.query.newpath,(err)=>{
					res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
					if(err){
						res.sendStatus(500);
					}
					else{
						res.sendStatus(200);
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
				ufs.calculateFolderSize(req.query.path,true,function(err,size){
					res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
					if(err) 
						res.status(500).send(err.toString());
					else 
						res.status(200).send(size.toString());
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
				ufs.deleteFile(req.query.path,function(err){
					res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
					if(err) 
						res.status(500).send(err.toString());
					else 
						res.sendStatus(200);
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
					ufs.shareFile(req.query.path,1, function(err){
						res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
						if(err){
							res.status(500).send(err.name);
						}
						else{
							res.sendStatus(200);
						}
					});
				}
				else{
					res.status(543).send("File path required");
				}
				return;
			case "linksharefile":
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
						res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
						if (err) {
							res.status(500).send(err.name);
						}
						else {
							res.status(200).send(link);
						}
					});
				}
				else {
					res.status(543).send("File path required");
				}
				return;
			case "file":
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
					}
					catch(err){
						//Check what error was and send the appropriate response (look the code of the error inside UserFileSystem.js)
						//Just to be sure, better reset fileTree to undefined
						fileTree = undefined;
						if(err.errorNumber == 2){
							res.sendStatus(404);
						}
						else{
							res.sendStatus(500);
						}
					}
					//Send the file tree if no errors occured (so if fileTree != undefined)
					res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
					if(fileTree) res.send(JSON.stringify(fileTree));
				}
				else{
					res.status(542).send("Folder path required");
				}
				return;
			//Default returns a file tree, even if the path requested is a file path
			default:
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
				if(!stat.isDirectory){
					req.query.path = req.query.path.substring(0,req.query.path.lastIndexOf("/"));
				}
				var fileTree;
				try {
					fileTree = ufs.getFileTree(req.query.level, ufs.getMachinePath(req.query.path));
				}
				catch (err) {
					//Check what error was and send the appropriate response (look the code of the error inside UserFileSystem.js)
					//Just to be sure, better reset fileTree to undefined
					fileTree = undefined;
					if (err.errorNumber == 2) {
						res.sendStatus(404);
					}
					else {
						res.sendStatus(500);
					}
				}
				//Send the file tree if no errors occured
				res.setHeader("Cache-Control","no-cache, no-store, must-revalidate");
				if (fileTree) res.send(JSON.stringify(fileTree));
				return;
		}
	}
	else {
		res.redirect("login");
	}
	
});
app.post("/files",function(req,res){
	
	//Send 545 "File required" if no file was sent, without doing any additional useless work
	if(!req.files.files){
		res.status(545).end("File required");
		return;
	}

	//Recover the user's data and file system instance, or create one if dosen't exists
	let username = req[sessionName].username;
	let userData = userManager.getUserData(username,true);
	let ufs = getUserFileSystemFromUserData(userData);

	
	let pathString = req.body.path || ufs.getCurrentHcsFolder();

	if(ufs.existsSync(pathString,true)){
		if(!(req.files.files instanceof Array)){
			req.files.files = [req.files.files];
		}
		var fileIndex = 0;
		for(let file of req.files.files){
			console.log(`${username} is writing file: ${ufs.resolve(pathString+"/"+file.name)}`);
			ufsPath = ufs.getMachinePath(pathString+"/"+file.name);
			file.mv(ufsPath,(err)=> {
				if(err){
					res.sendStatus(500);
					fileIndex = -1;
				}
				if(fileIndex > -1) fileIndex++;
				if(fileIndex >= req.files.files.length){
					res.status(200).send(ufs.parse(pathString+"/"+req.files.files[0].name,true));
				}
			});
		}
	}
	else{
		res.sendStatus(404);
	}
});


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


io.on("connection",function(userWS){
	//Check if user logged in
	var userSession = session.getRawSession(userWS.handshake.headers.cookie,true);
	if(!userSession){
		userWS.disconnect(true);
		return;
	}

	var username = userSession.username;
	userWS.join(username);

	

});


function getUserFileSystemFromUserData(userData){
	if(!userData.ufs){
		userData.ufs = new UserFileSystem(userData.username,configuration.getRootFolderArray());
	}
	else if(!(userData.ufs instanceof UserFileSystem)){
		userData.ufs = UserFileSystem.createFromBackupObject(userData.ufs);
	}
	return userData.ufs;
}
