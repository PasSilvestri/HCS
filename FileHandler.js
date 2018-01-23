var fs = require("fs");
var pathlib = require("path");

/**
 * Loads some data saved onto a file in json
 * @param {String} path - Path of the file containing the JSON data to load
 * @param {Boolean} [raw = false] - True if you need the raw json data to be returned
 * @returns {*} - Whatever data the file was or null if no data was loaded
 */
function loadDataFromJsonFile(path,raw = false){
	var data = null;
	try{
        var jsonData = fs.readFileSync(path);
        if(!raw){
            data = JSON.parse(jsonData.toString());
        }
        else{
            data = jsonData;
        }
	}
	catch(err){
		console.log("Error " + err.code + " reading file: " + path);
	}
	return data;
}

/**
 * Saves the data passed to it in the file
 * @param {*} data - The data object to save on the file 
 * @param {String} path - The path (filename included) of the file where to save the data
 */
function saveDataToJsonFile(data,path){
	//Create all the intermediate folders if they don't exists
	createIntermediatePath(path.substring(0,path.lastIndexOf(pathlib.sep)));
	var jsonData = JSON.stringify(data);
	fs.writeFile(path,jsonData,function(err){
		if(err){
			console.log("Error saving data to file " + err.code);
		}
	});
}

function createIntermediatePath(path) {
	if (!pathlib.isAbsolute(path)) {
		path = pathlib.resolve(path);
	}

	let pathParts = path.split(pathlib.sep);
	let index = 0;
	let currentPath = pathlib.resolve(pathParts[0]+"/");
	let error;

	while( (!error || error.code == 'EEXIST' || error.code == 'EPERM' ) && ++index < pathParts.length ){
		error = undefined;
		currentPath = pathlib.resolve(currentPath,pathParts[index]+"/");
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

function deleteFolderRecursive(path,delRootFolder = true) {
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(function (file, index) {
			var curPath = path + "/" + file;
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath,true);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		if(delRootFolder){
			fs.rmdirSync(path);
		}
	}
};

module.exports.loadDataFromJsonFile = loadDataFromJsonFile;
module.exports.saveDataToJsonFile = saveDataToJsonFile;
module.exports.deleteFolderRecursive = deleteFolderRecursive;