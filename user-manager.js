var fs = require("fs");
var path = require("path");
var bcrypt = require("bcryptjs");
var loadDataFromJsonFile = require("./FileHandler").loadDataFromJsonFile;
var saveDataToJsonFile = require("./FileHandler").saveDataToJsonFile;

function genUniqueID(salt = ""){
	return `hcs${salt}-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


function UserManager(cleanUp = false){
	
	this.secureDir = path.join(__dirname,"data","secure-data");
	this.signupDataDir = path.join(__dirname,"data","signup-data");
	this.signupDataPath = path.join(__dirname,"data","signup-data","users.json");
	this.userDataDir = path.join(__dirname,"data","user-data");

	//Clean up old data if requested and create folders if they don't exist
	if(cleanUp){
		deleteFolderRecursive(this.secureDir, false);
		createIntermediatePath(this.secureDir);
		deleteFolderRecursive(this.signupDataDir, false);
		createIntermediatePath(this.signupDataDir);
	}
	
	
	//List of the users signed up. Is a list of objects {username {String}, email {String} }
	this.registeredUsers = loadDataFromJsonFile(this.signupDataPath) || [];

	/**
	 * List of objects containing the user data and the timeouts to hand the data
	 * Is a list of object {
	 * 	user {Object} - the object with the user data
	 * 	autoSaveTimeout {Timeout} - The timeout for saving the data to file
	 * 	deleteTimeout {Timeout} - The timeout that deletes form ram the data when not used for a long time
	 * }
	 */
	this.usersData = {};

	/**
	 * Is the default function to create a default userData object
	 */
	this.savedCreateDefaultObjFun = function(username){return {username: username}};

	/**
	 * Saves the default function to create a default userData object
	 * @param {Function} createDefaultObjFun - The function to save. It has to return an object
	 */
	this.setDefaultUserDataFunction = function(createDefaultObjFun){
		if(createDefaultObjFun && typeof createDefaultObjFun == "function"){
			this.savedCreateDefaultObjFun = createDefaultObjFun;
		}
	}
	
	/**
	 * List of objects with the confirmation token as identifier of the data of the user that just signed up
	 * Is a list of objects {username {String}, email {String}, password {String} - hashed}
	 */
	this.confirmationTokens = [];
	

	/**
	 * Checks if the password passed is the password of the user passed
	 * @param {String} username - The unique username to check the password against
	 * @param {String} password - The password to check
	 * @returns {Boolean} - Whether the password was correct or not
	 */
	this.authUser = function(username,password){
		try{
			var hash = fs.readFileSync(path.join(this.secureDir,username));
			return bcrypt.compareSync(password,hash.toString());
		}
		catch(err){
			return false;
		}
	}
	
	/**
	 * The response to a signup request. The result codecan be: 1 = accepted, 2 = username unavailable, 3 = email unavailable, 4 = invalid data
	 * @typedef {Object} SignupResponse
	 * @property {Number} result - The result code, 1 = accepted, 2 = username unavailable, 3 = email unavailable, 4 = invalid data
	 * @property {String} token - The unique token generated or undefined if the request was rejected
	 * @property {String} message - Textual result corrisponding to the result code 
	 */
	/**
	 * Function that generates a unique token to use for the user to confirm his account, saves the token and the infos on the user,
	 * and will eventually save them if confirmUser is called with this token
	 * @param {String} username - A unique username to associate to the user
	 * @param {String} password - The password for the account, will be hashed
	 * @param {String} email - The email of the user
	 * @param {Object} options - An object with some additional information on the user, this will be saved in the user's userData object when confirming the account
	 * @returns {SignupResponse} - The signupResponse object for this request
	 */
	//Result 1=can signup, need to confirm, 2=username unavailable, 3=email unavailable
	this.signupUser = function(username,password,email,options){

		//If some data is undefined send
		if(!username || !password || !email){
			return {
				result: 4,
				token: undefined,
				message: "Invalid data sent"
			};
		}

		//Check if the data is invalid, malformed email, etc
		username = username.trim() || "";
		password = password.trim() || "";
		email = email.trim() || "";

		if(username == "" || password == "" || email.indexOf("@") == -1 || email.length < 4){
			return {
				result: 4,
				token: undefined,
				message: "Invalid data sent"
			};
		}
		
		var res2 = {
				result: 2,
				token: undefined,
				message: "Username unavailable"
		};
		
		var res3 = {
				result: 3,
				token: undefined,
				message: "Email already used"
		};

		for(var i=0; i<this.registeredUsers.length; i++){
			//Check if the username is already present
			if(this.registeredUsers[i].username == username){
				return res2;
			}
			//Check if the email is already present
			else if(this.registeredUsers[i].email == email){
				return res3;
			}
		}
		
		
		//Signup possible
		//Generate a confiramtion token
		var temptoken = genUniqueID();
		//Add it to the list of tokens waiting for confirmation
		this.confirmationTokens[temptoken] = {
			username: username,
			email: email,
			password: bcrypt.hashSync(password),
			options: options
		};
		//Set a timeout of 30 minutes to invalidate the token
		this.confirmationTokens[temptoken].timeoutID = setTimeout(function(){
			if(this.confirmationTokens[temptoken]){
				console.log(this.confirmationTokens[temptoken].username + "'s signup confirmation token expired");
				delete this.confirmationTokens[temptoken];
			}
		}.bind(this),(1000*60*30)); //30 minutes for confirmation
		
		var res = {
			result: 1,
			token: temptoken,
			message: "Signup accepted"
		}
		return res;
	}
	
	
	this.confirmUser = function (token) {
		if (token != undefined && this.confirmationTokens[token]) {
			//Clearing the expiration timeout for this token
			clearTimeout(this.confirmationTokens[token].timeoutID);
			//Storing all the signup information in the list of already registered users
			this.registeredUsers.push({
				username: this.confirmationTokens[token].username,
				email: this.confirmationTokens[token].email,
			});
			//Save to file the hashed password
			fs.writeFile(path.join(this.secureDir, this.confirmationTokens[token].username),
				this.confirmationTokens[token].password,
				function (err) {
					if (err) {
						console.log(err);
					}
				}
			);
			//Save the new registered user to file
			saveDataToJsonFile(this.registeredUsers, this.signupDataPath);

			//Saving the data from the options object inside the user's userData object, if there is
			if(this.confirmationTokens[token].options){
				//Create the userData in memory by using the load method with the flag createIfNeeded to true
				this.loadUserData(this.confirmationTokens[token].username, true);
				//Save to the userData all the parameters inside options
				let uName = this.confirmationTokens[token].username;
				let opt = this.confirmationTokens[token].options;
				let keys = Object.keys(this.confirmationTokens[token].options);
				for(let i=0; i<keys.length-1; i++){
					let key = keys[i];
					this.saveUserData(uName,key,opt[key]);
				}
				//Saving the last one separatelly because we need to send to it the 3rd optional parameter to force the saving to file of this new data
				let key = keys[keys.length-1];
				this.saveUserData(uName,key,opt[key],{forceSave: true});
			}
			//Delete the token record, cause it's useless now
			delete this.confirmationTokens[token];
			return 1;
		}
		return 0;
	}
	
	/**
	 * Return the data of the user if in memory, load it from file (if createIfNeeded is set to true) and then returns it otherwise
	 * @param {String} username - The username as unique identifier
	 * @param {Boolean} [createIfNeeded = false] - A flag that determins whether create the user data if not found in memory, default true
	 * @param {Function} [createDefaultObjFun] - A function that return an object with the default values of the data to create. It recives the username
	 * @returns - The data of the spcified user 
	 */
	this.getUserData = function(username,createIfNeeded = false, createDefaultObjFun){
		//Load the data in memory (and eventually create it) if not present
		this.loadUserData(username,createIfNeeded,createDefaultObjFun);
		//Return this data
		return this.usersData[username].user;
	}

	/**
	 * Load in memory the data of the user if not present. Also can be used to create the data of a user when is not present, or
	 * refresh the lifetime of the data if already loaded (the timer to delete the data if not used)
	 * @param {String} username - The unique key of the user 
	 * @param {Boolean} [createIfNeeded = false] - A flag set to false by default. If set to true, creates the data for the user if not present in memory
	 * @param {Function} [createDefaultObjFun] - A function that return an object with the default values of the data to create. It recives the username
	 * @returns {Boolean} - Whether the data was loaded or not
	 */
	this.loadUserData = function(username, createIfNeeded = false, createDefaultObjFun){
		if(this.usersData[username] != undefined){
			//Clear the old timeout
			clearTimeout(this.usersData[username].deleteTimeout);
		}
		else{
			this.usersData[username] = {};
			//Load the data from file
			let user = loadDataFromJsonFile(path.join(this.userDataDir,username+".json"));
			//Create the data if it doesn't exists and is required to be created
			if(user == undefined){
				if(createIfNeeded){
					this.usersData[username].user = this.createUserData(username, createDefaultObjFun);
				}
				else{
					return 0;
				}
			}
			else{
				//There was a data file for this user, save into its userData object
				this.usersData[username].user = user;
			}
			//Setting the autosave timeout every hour
			this.usersData[username].autoSaveTimeout = setTimeout(recursiveAutoSave.bind(this),(1000*60*60),username);

		}

		//Set the new timeout to delete the data if not used within 5 hours
		this.usersData[username].deleteTimeout = setTimeout(function(){
			this.forceRemoveUserData(username);
			console.log(username + " data has been removed from memory, because not used for long time");
		}.bind(this),(1000*60*60*5),username);

		return 1;
	}

	/**
	 * Saves data passed for the user with username passed
	 * @param {String} username - The username of the user
	 * @param {String} paramName - The parameter to add or change
	 * @param {String} [paramValue = ""] - The value for the parameter. By default is ""
	 * @param {Object} [options] - An object with some options.
	 * @param {Boolean} [options.forceSave] - To force saving to file the data
	 * @param {Boolean} [options.delete] - To delete the paramName passed from the userData object
	 * @returns {Boolean} - True if the operation succeded, false otherwise
	 */
	this.saveUserData = function(username,paramName,paramValue = "",options = {}){
		if(this.usersData[username] == undefined){
			this.loadUserData(username);
		}
		if(this.usersData[username] != undefined){
			if(options && options.delete == true){
				delete this.usersData[username].user[paramName]
			}
			else{
				this.usersData[username].user[paramName] = paramValue;
			}
			//Force the saving to file
			if(options.forceSave == true){
				saveDataToJsonFile(this.usersData[username].user,path.join(this.userDataDir,username+".json"));
				clearTimeout(this.usersData[username].autoSaveTimeout);
				this.usersData[username].autoSaveTimeout = setTimeout(recursiveAutoSave.bind(this),(1000*60*60),username);
			}
			return 1;
		}
		return 0;
	}

	/**
	 * Creates the user data with some default values and saves it to a file
	 * @param {String} username - The username as unique key for the user to be created
	 * @param {Function} [createDefaultObjFun] - A function that return an object with the default values of the data to create. It recives the username
	 * @returns {Object} - The object with the newly created data
	 */
	this.createUserData = function(username, createDefaultObjFun){
		//Default values for the user data

		// Creating the user object with username and the rest of the default data
		var user = {username: username};
		if(!createDefaultObjFun){
			createDefaultObjFun = this.savedCreateDefaultObjFun;
		}
		let tempData = createDefaultObjFun(username);
		let keys = Object.keys(tempData);
		for(let i=0; i<keys.length; i++){
			user[keys[i]] = tempData[keys[i]];
		}

		fs.writeFile(path.join(this.userDataDir,username+".json"),JSON.stringify(user),(err) => {
			if(err && err.code){
				console.log("Error " + err.code + " while creating user data file");
			}
		});
		return user;
	}

	/**
	 * Recursive calling timeout to save data to file. Gets called the first by "getUserData"
	 * @param {String} username - The string of user's data to save to file and relaunch 
	 */
	var recursiveAutoSave = function(username){
		if(this.usersData[username]){
			saveDataToJsonFile(this.usersData[username].user,path.join(this.userDataDir,username+".json"));
			this.usersData[username].autoSaveTimeout = setTimeout(recursiveAutoSave.bind(this),(1000*60*60),username);
		}
	}

	/**
	 * Used to force removing user data from memory, saves it to file before, then clears the timeouts for saving and deleting
	 * @param {String} username
	 */
	this.forceRemoveUserData = function(username){
		if(this.usersData[username]){
			clearTimeout(this.usersData[username].autoSaveTimeout);
			saveDataToJsonFile(this.usersData[username].user,path.join(this.userDataDir,username+".json"));
			clearTimeout(this.usersData[username].deleteTimeout);
			delete this.usersData[username];
		}
		
	}



}


function deleteFolderRecursive(pathString,delRootFolder = true) {
	if (fs.existsSync(pathString)) {
		fs.readdirSync(pathString).forEach(function (file, index) {
			console.log("Deleteing file/folder " + file);
			var curPath = pathString + "/" + file;
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath,true);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		if(delRootFolder){
			fs.rmdirSync(pathString);
		}
	}
}

function createIntermediatePath(pathString) {
	if (!path.isAbsolute(pathString)) {
		pathString = path.resolve(pathString);
	}

	let pathParts = pathString.split(path.sep);
	let index = 0;
	let currentPath = path.resolve(pathParts[0]+"/");
	let error;

	while( (!error || error.code == 'EEXIST' || error.code == 'EPERM' ) && ++index < pathParts.length ){
		error = undefined;
		currentPath = path.resolve(currentPath,pathParts[index]+"/");
		try {
			fs.mkdirSync(currentPath);
		} catch (err) {
			error = err;
			if (err.code !== 'EEXIST' && err.code !== 'EPERM') {
				throw err;
			}
		}
	}
}

module.exports = UserManager;