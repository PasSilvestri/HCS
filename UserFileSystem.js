var fs = require("fs");
var path = require("path");
var mime = require("mime");
var ncp = require("ncp"); //Copies full folders
var isPathValid = require('is-valid-path');
var getFolderSize = require('get-folder-size');
var RootFolder = require("./Configuration").RootFolder;
var FileTree = require("./FileSystemObjects").FileTree;
var HCSFile = require("./FileSystemObjects").HCSFile;
var HCSDirectory = require("./FileSystemObjects").HCSDirectory;
var HCSSymLink = require("./FileSystemObjects").HCSSymLink;
var PDatabase = require("./PDatabase");

class UserFileSystem{

    /**
     * Creates a file system for a specific user
     * @param {String} username - The username for this file system
     * @param {Array} rootfolders - The rootfolders for this file system
     * @param {Object} [databasePerRootfolder] - An object with rootfolders name as properies with the database for that rootfolder
     */
    constructor(username,rootfolders,databasePerRootfolder = {}){
        //Let use the default rootfolder if not passed
        if (!rootfolders) {
            rootfolders = [];
            rootfolders.push(new RootFolder());
        }
        //If rootfolders is not an array, let's make it into one
        if (!rootfolders instanceof Array) {
            rootfolders = [rootfolders];
        }
        this.rootFolderList = {};
        this.databases = {};
        //Let's clear the rootfolder list, 
        //if the user is not allowed in this root folder remove the root folder from the list
        //else if he is allowed, add the copy of the folder specific to this user to the list
        for (let i in rootfolders) {
            if (!rootfolders[i].isUserAllowed(username)) {
                rootfolders.splice(i, 1);
            }
            else {
                let f = rootfolders[i]; //The folder we are talking about
                let p = path.join(f.path, username); //The user's folder inside this rootfolder
                this.rootFolderList[f.name] = new RootFolder(f.name, p, f.all, f.usersAccepted, f.usersNotAccepted);
                //Create the rootfolder directory and its trash, pulicshare and linkshare
                createIntermediatePath(p + "/$hcs$trash");
                createIntermediatePath(p + "/$hcs$linkshare");
                createIntermediatePath(p + "/$hcs$publicshare");
                //Creating the database for this rootfolder and user
                createIntermediatePath(p + "/$hcs$data");
                if(databasePerRootfolder[f.name] && databasePerRootfolder[f.name].databaseFolder == (p + "/$hcs$data")){
                    this.rootFolderList[f.name].database = databasePerRootfolder[f.name];
                }
                else{
                    this.rootFolderList[f.name].database = new PDatabase(p + "/$hcs$data");
                }
                this.databases[f.name] = this.rootFolderList[f.name].database;
                

                /*
                if( !fs.existsSync(p) ){
                    require("child_process").exec("mkdir "+p);
                }
                */
            }
        }
        //Now the rootfolders array has been cleaned from all inaccesible root folders, so if its length == 0, throw error
        if (rootfolders.length == 0) {
            //Error: No root folder available
            throw new UserFileSystemError(1);
        }
        //The root folders not customized for this specific user
        this.plainRootFolders = rootfolders;


        this.username = username;
        this.currentRootFolder = rootfolders[0].name;
        this.currentHcsFolder = this.currentRootFolder + "/";
        this.currentMachineFolder = this.getMachinePath(this.currentHcsFolder);
    }

    /**
     * Change the current working directory in the HCS file system
     * @param {String} pathString - The new path to use as current working directory
     * @returns {boolean} - If the change was succesful or not
     */
    setCurrentHcsFolder(pathString){
        //Sending "./" is used kind of as a placeholder,
        //cause the server will send back the current folder without doing all the work to change the folder and set it back to itself
        if(pathString.trim() == "./"){
            return true;
        }
        pathString += "/";
        if(this.existsSync(pathString,true)){
            let stat = fs.lstatSync(this.getMachinePath(pathString));
            if(!stat.isDirectory()){
                //Error: Folder path required
                throw new UserFileSystemError(4,pathString);
            }
            //Resolve the path with an additional "/" in front of it just to be sure
            pathString = this.resolve(pathString + "/",true);
            this.currentRootFolder = this.parse(pathString,true).root;
            this.currentMachineFolder = this.getMachinePath(pathString);
            this.currentHcsFolder = pathString;
            return true;
        }
        return false;
    }

    /**
     * Returns the current hcs folder
     */
    getCurrentHcsFolder(){
        return this.currentHcsFolder;
    }

    /**
     * Returns the current root folder
     */
    getCurrentRootFolder(){
        return this.currentRootFolder;
    }

    getRootFolderNames(){
        let fArray = Object.values(this.rootFolderList);
        for(let i in fArray){
            fArray[i] = fArray[i].name;
        }
        return fArray;
    }

    /**
     * Returns a file tree of the folder spcified or the current folder if not specified
     * @param {Number} [level = 1] - The deepnes of the file system tree to analize
     * @param {String} [path = currentFolder] - The path to analize
     * @returns {FileTree} - The file tree for the folder 
     */
    getFileTree(level = 1,pathString){
        if(level < 1){
            return;
        }
        if(!pathString){
            pathString = this.currentMachineFolder;
        }
        
        let database = this.getCorrespondingDatabase(this.getHCSPath(pathString));
        let fileTable = (database) ? database.getTable("file","ino") : {};
        let fileList;
        try{
            pathString = this.resolve(pathString+"/");
            if(!pathString){
                //Error: Path doesn't exists
                throw new UserFileSystemError(2,pathString);
            }
            fileList = fs.readdirSync(pathString);
        }
        catch(err){
            console.log(err);
            //If some error occured, if is not a UserFileSystem error let's wrap it into one and send it to the client
            if(!err instanceof UserFileSystemError){
                //Error: Error wrapper for another node.js error
                err = new UserFileSystemError(0,err);
            }
            let nullFileTree = new FileTree(pathString,pathString);
            nullFileTree.setError(err);
            return nullFileTree;
        }

        var fileTree = new FileTree(pathString,this.getHCSPath(pathString));
        for(let f of fileList){
            //All files and folders starting with $hcs$ are HCS system files/folders
            //All files and folders starting with #sec# are secret files/folders
            if(f.startsWith("$hcs$") || f.startsWith("#sec#")){
                continue;
            }
            let pa = path.join(pathString,f);
            let stat = fs.lstatSync(pa);

            //Creating the info object to pass to the FileSystemObject with the database informations
            let fileInfoTemp = fileTable.get(stat.ino,"ino") || {};
            let fileInfo = {
                linkShared: fileInfoTemp.linkShared,
                publicShared: fileInfoTemp.publicShared
            }
            if(fileInfoTemp.linkShared){
                fileInfo.link = fileInfoTemp.link;
            }

            if(stat.isDirectory()){
                let fsObject = new HCSDirectory(pa,this.getHCSPath(pa),stat.size,"General",stat.mtimeMs,fileInfo);
                fileTree.addDirectory(fsObject);
            }
            else if(stat.isFile()){
                let fsObject = new HCSFile(pa,this.getHCSPath(pa),stat.size,mime.getType(pa),stat.mtimeMs,fileInfo);
                fileTree.addFile(fsObject);
            }
            else if(stat.isSymbolicLink()){
                let fsObject = new HCSSymLink(pa,this.getHCSPath(pa),fileInfo);
                fileTree.addLink(fsObject);
            }
        }

        //If is negative will go on until the bottom of the file tree
        if(level > 1 || level < 0){
            for(let subDir of fileTree.getDirList()){
                let subFileTree = this.getFileTree(level-1,subDir.machinePath);
                subDir.setFileTree(subFileTree);
            }
        }
        

        return fileTree;
    }

     /**
     * Returns a file tree starting from the folder spcified or the current folder if not specified, with just the files matching
     * @param {String} searchString - The string to match
     * @param {String} [path = currentFolder] - The path to analize
     * @returns {FileTree} - The file tree for the folder 
     */
    getSearchFileTree(searchString = "",pathString){
        searchString = searchString.trim().replace(/\s+/g," ").toLowerCase();
        if(!pathString){
            pathString = this.currentMachineFolder;
        }
        
        let database = this.getCorrespondingDatabase(this.getHCSPath(pathString));
        let fileTable = (database) ? database.getTable("file","ino") : {};
        let fileList;
        try{
            pathString = this.resolve(pathString+"/");
            if(!pathString){
                //Error: Path doesn't exists
                throw new UserFileSystemError(2,pathString);
            }
            fileList = fs.readdirSync(pathString);
        }
        catch(err){
            console.log(err);
            //If some error occured, if is not a UserFileSystem error let's wrap it into one and send it to the client
            if(!err instanceof UserFileSystemError){
                //Error: Error wrapper for another node.js error
                err = new UserFileSystemError(0,err);
            }
            let nullFileTree = new FileTree(pathString,pathString);
            nullFileTree.setError(err);
            return nullFileTree;
        }

        var fileTree = new FileTree(pathString,this.getHCSPath(pathString));
        var dirToVisit = [];
        for(let f of fileList){
            //All files and folders starting with $hcs$ are HCS system files/folders
            //All files and folders starting with #sec# are secret files/folders
            if(f.startsWith("$hcs$") || f.startsWith("#sec#")){
                continue;
            }
            let pa = path.join(pathString,f);
            let stat = fs.lstatSync(pa);
            let fileFormattedName = f.toLowerCase().replace(/\s+/g," ");
            if(stat.isDirectory()){
                dirToVisit.push(pa);
                if(fileFormattedName.includes(searchString)){

                    //Creating the info object to pass to the FileSystemObject with the database informations
                    let fileInfoTemp = fileTable.get(stat.ino,"ino") || {};
                    let fileInfo = {
                        linkShared: fileInfoTemp.linkShared,
                        publicShared: fileInfoTemp.publicShared
                    }
                    if(fileInfoTemp.linkShared){
                        fileInfo.link = fileInfoTemp.link;
                    }

                    let fsObject = new HCSDirectory(pa,this.getHCSPath(pa),stat.size,"General",stat.mtimeMs,fileInfo);
                    fileTree.addDirectory(fsObject);
                }
            }
            else if(fileFormattedName.includes(searchString)){

                //Creating the info object to pass to the FileSystemObject with the database informations
                let fileInfoTemp = fileTable.get(stat.ino,"ino") || {};
                let fileInfo = {
                    linkShared: fileInfoTemp.linkShared,
                    publicShared: fileInfoTemp.publicShared
                }
                if(fileInfoTemp.linkShared){
                    fileInfo.link = fileInfoTemp.link;
                }

                if(stat.isFile()){
                    let fsObject = new HCSFile(pa,this.getHCSPath(pa),stat.size,mime.getType(pa),stat.mtimeMs,fileInfo);
                    fileTree.addFile(fsObject);
                }
                else if(stat.isSymbolicLink()){
                    let fsObject = new HCSSymLink(pa,this.getHCSPath(pa),fileInfo);
                    fileTree.addLink(fsObject);
                }
            }
        }

        //If is negative will go on until the bottom of the file tree
        for (let subDir of dirToVisit) {
            let subFileTree = this.getSearchFileTree(searchString, subDir);
            fileTree.merge(subFileTree);
        }
        
        return fileTree;
    }

    /**
     * Calculate recursivelly the size of a folder. If the pathString indicates a file, the file size is returned
     * @param {String} pathString - The path of the folder
     * @param {boolean} [hcs = false] - Wheather or not resolve the path against the HCS file system insted of the machine file system
     * @param {Function} callback - The callback called with error and size as a parameters
     * @returns {Number} - The size of the folder/file
     */
    calculateFolderSize(pathString,hcs = false,callback){
        if(typeof hcs == "function"){
            callback = hcs;
            hcs = false;
        }
        if(hcs) pathString = this.getMachinePath(pathString);
        getFolderSize(pathString,callback);
    }



    /**
     * Calculate recursivelly the size of a folder. If the pathString indicates a file, the file size is returned
     * @param {String} pathString - The path of the folder
     * @param {boolean} [hcs = false] - Wheather or not resolve the path against the HCS file system insted of the machine file system
     * @returns {Number} - The size of the folder/file
     */
    calculateFolderSizeSync(pathString,hcs = false){
        var size = 0;
        if(hcs) pathString = this.getMachinePath(pathString);
        let fileList;
        try{
            fileList = fs.readdirSync(pathString);
        }
        catch(err){
            //If is a file return its size
            return fs.lstatSync(pathString).size;
        }
        
        for(let f of fileList){
            let stat = fs.lstatSync(path.join(pathString,f));
            if(!stat.isDirectory()){
                size += stat.size;
            }
            else{
                size += calculateFolderSizeSync(path.join(pathString,f),false);
            }
        }
        return size;
    }


    writeFile(data,path,options,callback){

        if(!path){
            path = this.currentMachineFolder+"/file";
        }
        else{
            path = this.getMachinePath(path);
        }

        fs.writeFile(path,data,options,callback);
    }

    writeFileSync(data,path,options){
        if(!path){
            path = this.currentMachineFolder;
        }
        else{
            path = this.getMachinePath(path);
        }
        fs.writeFileSync(path, data, options);
    }

    readFile(path,options,callback){
        path = this.getMachinePath(path);
        fs.readFile(path,options,callback);
    }

    readFileSync(path,options){
        path = this.getMachinePath(path);
        return fs.readFileSync(path,options);
    }

    createFolder(pathString,mode,callback){
        let pathData = this.parse(pathString,true);
        //Cannot delete hcs system folders
        if(pathData.base.startsWith("$hcs$")){
            //Error: Non valid path
            callback(new UserFileSystemError(3));
            return;
        }

        if (typeof mode === 'function'){
            callback = mode;
            mode = 0o777;
        }
        pathString = this.getMachinePath(pathString);
        let pathParts = pathString.split(path.sep);
        let index = 0;
        let currentPath = pathParts[index] + "/";

        let mkdirHelperRecursiveFunction = function(err){
            index++;
            if((!err || err.code == 'EEXIST' ) && index < pathParts.length){
                currentPath = path.resolve(currentPath,pathParts[index]);
                fs.mkdir(currentPath,mode,mkdirHelperRecursiveFunction);
            }
            else{
                callback(err);
            }
        }

        fs.mkdir(pathParts[index],mode,mkdirHelperRecursiveFunction);
    }

    createFolderSync(pathString, mode) {
        let pathData = this.parse(pathString,true);
        //Cannot delete hcs system folders
        if(pathData.base.startsWith("$hcs$")){
            //Error: Non valid path
            throw new UserFileSystemError(3);
        }

        pathString = this.getMachinePath(pathString);
        let pathParts = pathString.split(path.sep);
        let index = 0;
        let currentPath = path.resolve(pathParts[0]+"/");
        let error;

        while( (!error || error.code == 'EEXIST' || error.code == 'EPERM' ) && ++index < pathParts.length ){
            error = undefined;
            currentPath = path.resolve(currentPath,pathParts[index]+"/");
            try {
                fs.mkdirSync(currentPath, mode);
            } catch (err) {
                error = err;
                if (err.code !== 'EEXIST' && err.code !== 'EPERM') {
                    throw err;
                }
            }
        }
    }


    deleteFile(pathString,callback){
        let machinePathString = this.getMachinePath(pathString);
        let pathData = this.parse(pathString,true);
        //Cannot delete hcs system folders
        if(pathData.base.startsWith("$hcs$")){
            //Error: Non valid path
            callback(new UserFileSystemError(3));
            return;
        }
        let pathDir = this.resolve(pathData.dir+"/",true);

        let database = this.getCorrespondingDatabase(this.getHCSPath(pathString));
        let fileTable = (database) ? database.getTable("file","ino") : undefined;
        let stat = fs.statSync(machinePathString);
        let infoObj = (fileTable) ? fileTable.get(stat.ino, "ino") || {ino: stat.ino} : {ino: stat.ino};

        if(pathString.includes("$hcs$linkshare")){
            deleteRecursive(machinePathString,callback);
            //fs.unlink(machinePathString,callback);
            infoObj.linkShared = false;
            delete infoObj.link;
            delete infoObj.linkSharePath;
            //Store the new info in the database
            fileTable.store(infoObj);
        }
        else if(pathString.includes("$hcs$publicshare")){
            deleteRecursive(machinePathString,callback);
            //fs.unlink(machinePathString,callback);
            infoObj.publicShared = false;
            delete infoObj.publicSharePath;
            //Store the new info in the database
            fileTable.store(infoObj);
        }
        else if(pathString.includes("$hcs$trash")){
            //If it's in the trash folder, delete it
            deleteRecursive(machinePathString,callback);
            //fs.unlink(machinePathString,callback);
            //Remove the entri from the database
            fileTable.remove(stat.ino)
        }
        else{
            //If it's not a shared file nor is in the trash folder, move it there
            let trash = this.getTrashFolder(pathString);
            //Remove it from the public shared folder
            let ps = this.getPublicShareFolder(pathString);
            //Wheter it exists or not, unlink it
            deleteRecursiveSync(this.getMachinePath(ps.correspondingPath));
            //Remove it from the public shared folder
            let ls = this.getLinkShareFolder(pathString);
            //Wheter it exists or not, unlink it
            deleteRecursiveSync(this.getMachinePath(ls.correspondingPath));

            infoObj.linkShared = false;
            infoObj.publicShared = false;
            delete infoObj.link;
            delete infoObj.publicSharePath;
            delete infoObj.linkSharePath;
            infoObj.path = trash.machinePath+"/"+pathData.base;
            //Store the new info in the database
            fileTable.store(infoObj);

            //Delete any old folders/files with the same name in the trash folder
            deleteRecursiveSync(trash.machinePath+"/"+pathData.base);
            fs.rename(machinePathString,trash.machinePath+"/"+pathData.base,callback);
        }

        /*
        //Remove it from the public shared folder
        let ps = this.getPublicShareFolder(pathString);
        //Wheter it exists or not, unlink it
        fs.unlink(this.getMachinePath(ps.correspondingPath),(err) => {});

        //Remove it from the public shared folder
        let ls = this.getLinkShareFolder(pathString);
        //Wheter it exists or not, unlink it
        fs.unlink(this.getMachinePath(ls.correspondingPath),(err) => {});

        //If the file to delete was a shared file, we already deleted it
        if(pathString == ps.insidePath || pathString == ls.insidePath){
            callback(undefined);
        }

        //If the thing to delete is not already in the trash, or is a shared file, move it there
        if(pathDir != pathData.root + "/$hcs$trash/"){
           
            let trash = this.getTrashFolder(pathString);
            fs.rename(machinePathString,trash.machinePath+"/"+pathData.base,callback);
        }
        //Otherwise, if it's already in the trash folder, or is a shared file, delete it
        else{
            fs.unlink(machinePathString,callback);
        }
        */
    }

    deleteFileSync(pathString){
        let machinePathString = this.getMachinePath(pathString);
        let pathData = this.parse(pathString,true);
        //Cannot delete hcs system folders
        if(pathData.base.startsWith("$hcs$")){
            //Error: Non valid path
            throw new UserFileSystemError(3);
            return;
        }
        let pathDir = this.resolve(pathData.dir+"/",true);

        let database = this.getCorrespondingDatabase(this.getHCSPath(pathString));
        let fileTable = (database) ? database.getTable("file","ino") : undefined;
        let stat = fs.statSync(machinePathString);
        let infoObj = (fileTable) ? fileTable.get(stat.ino, "ino") || {ino: stat.ino} : {ino: stat.ino};

        if(pathString.includes("$hcs$linkshare")){
            deleteRecursiveSync(machinePathString);
            //fs.unlinkSync(machinePathString);
            infoObj.linkShared = false;
            delete infoObj.link;
            delete infoObj.linkSharePath;
            //Store the new info in the database
            fileTable.store(infoObj);
        }
        else if(pathString.includes("$hcs$publicshare")){
            deleteRecursiveSync(machinePathString);
            //fs.unlinkSync(machinePathString);
            infoObj.publicShared = false;
            delete infoObj.publicSharePath;
            //Store the new info in the database
            fileTable.store(infoObj);
        }
        else if(pathString.includes("$hcs$trash")){
            //If it's in the trash folder, delete it
            //Delete any old folders/files with the same name
            deleteRecursiveSync(machinePathString);
            //fs.unlinkSync(machinePathString);
            //Remove the entri from the database
            fileTable.remove(stat.ino)
        }
        else{
            //If it's not a shared file nor is in the trash folder, move it there
            let trash = this.getTrashFolder(pathString);
            try{
                //Remove it from the public shared folder
                let ps = this.getPublicShareFolder(pathString);
                //Wheter it exists or not, unlink it
                deleteRecursiveSync(this.getMachinePath(ps.correspondingPath));
                //Remove it from the public shared folder
                let ls = this.getLinkShareFolder(pathString);
                //Wheter it exists or not, unlink it
                deleteRecursiveSync(this.getMachinePath(ls.correspondingPath));
            }
            catch(err){}

            infoObj.linkShared = false;
            infoObj.publicShared = false;
            delete infoObj.link;
            delete infoObj.publicSharePath;
            delete infoObj.linkSharePath;
            infoObj.path = trash.machinePath+"/"+pathData.base;
            //Store the new info in the database
            fileTable.store(infoObj);

            //Delete any old folders/files with the same name in the trash folder
            deleteRecursiveSync(trash.machinePath+"/"+pathData.base);
            fs.renameSync(machinePathString,trash.machinePath+"/"+pathData.base);
        }

    }

    moveFile(srcPath,dstPath,callback){
        srcPath = this.resolve(srcPath);
        dstPath = this.resolve(dstPath);
        //If the 2 paths are equal, no more work is needed
        if(srcPath == dstPath){
            if(callback) callback();
            return;
        }
        let pathData = this.parse(srcPath,true);
        //Cannot move hcs system folders
        if(pathData.base.startsWith("$hcs$")){
            //Error 3: Non valid path
            if(callback) callback(new UserFileSystemError(3));
            return;
        }

        if(srcPath.includes("$hcs$linkshare") || dstPath.includes("$hcs$linkshare")){
            //Error 6: Non valid request
            if(callback) callback(new UserFileSystemError(6));
            return;
        }
        if(srcPath.includes("$hcs$publicshare") || dstPath.includes("$hcs$publicshare")){
            //Error 6: Non valid request
            if(callback) callback(new UserFileSystemError(6));
            return;
        }

        let srcPathMachine = this.getMachinePath(srcPath);
        let dstPathMachine = this.getMachinePath(dstPath);
        //Create the destination path if it doesn't exists
        createIntermediatePath(this.getMachinePath( dstPath.substring(0,dstPath.lastIndexOf("/")) ));

        let database = this.getCorrespondingDatabase(srcPath);
        let fileTable = (database) ? database.getTable("file","ino") : undefined;
        let stat = fs.statSync(srcPathMachine);
        let infoObj = (fileTable) ? fileTable.get(stat.ino, "ino") || {ino: stat.ino} : {ino: stat.ino};

        //This method aggressively overwrite any old data
        deleteRecursiveSync(dstPathMachine);
        fs.rename(srcPathMachine,dstPathMachine,function(err){
            if(err){
                callback(err);
                return;
            }
            //If the file was shared, delete the old hardlink in the share folder and reshare it (it won't write anything new on the disk, just create a new hardlink)
            if(infoObj.publicShared){
                deleteRecursiveSync(infoObj.publicSharePath);
                this.shareFile(dstPath,1,()=>{});
            }
            if(infoObj.linkShared){
                deleteRecursiveSync(infoObj.linkSharePath);
                this.shareFile(dstPath,2,()=>{});
            }
            //Store the new path in the database
            infoObj = (fileTable) ? fileTable.get(stat.ino, "ino") || {ino: stat.ino} : {ino: stat.ino};
            infoObj.path = dstPathMachine;
            fileTable.store(infoObj);

            callback();
        }.bind(this));
    }

    moveFileSync(srcPath,dstPath){
        srcPath = this.resolve(srcPath);
        dstPath = this.resolve(dstPath);
        //If the 2 paths are equal, no more work is needed
        if(srcPath == dstPath){
            return;
        }
        let pathData = this.parse(srcPath,true);
        //Cannot move hcs system folders
        if(pathData.base.startsWith("$hcs$")){
            //Error 3: Non valid path
            throw new UserFileSystemError(3);
        }

        if(srcPath.includes("$hcs$linkshare") || dstPath.includes("$hcs$linkshare")){
            //Error 6: Non valid request
            throw new UserFileSystemError(6);
        }
        if(srcPath.includes("$hcs$publicshare") || dstPath.includes("$hcs$publicshare")){
            //Error 6: Non valid request
            throw new UserFileSystemError(6);
        }

        let srcPathMachine = this.getMachinePath(srcPath);
        let dstPathMachine = this.getMachinePath(dstPath);
        //Create the destination path if it doesn't exists
        createIntermediatePath(this.getMachinePath( dstPath.substring(0,dstPath.lastIndexOf("/")) ));

        let database = this.getCorrespondingDatabase(srcPath);
        let fileTable = (database) ? database.getTable("file","ino") : undefined;
        let stat = fs.statSync(srcPathMachine);
        let infoObj = (fileTable) ? fileTable.get(stat.ino, "ino") || {ino: stat.ino} : {ino: stat.ino};

        //This method aggressively overwrite any old data
        deleteRecursiveSync(dstPathMachine);
        fs.renameSync(srcPathMachine,dstPathMachine);
        //If the file was shared, delete the old hardlink in the share folder and reshare it (it won't write anything new on the disk, just create a new hardlink)
        if(infoObj.publicShared){
            deleteRecursiveSync(infoObj.publicSharePath);
            this.shareFile(dstPath,1,()=>{});
        }
        if(infoObj.linkShared){
            deleteRecursiveSync(infoObj.linkSharePath);
            this.shareFile(dstPath,2,()=>{});
        }
        //Store the new path in the database
        infoObj = (fileTable) ? fileTable.get(stat.ino, "ino") || {ino: stat.ino} : {ino: stat.ino};
        infoObj.path = dstPathMachine;
        fileTable.store(infoObj);
    }

    copyFile(srcPath,dstPath,callback){
        let pathData = this.parse(srcPath,true);
        //Cannot move hcs system folders
        if(pathData.base.startsWith("$hcs$")){
            //Error 3: Non valid path
            if(callback) callback(new UserFileSystemError(3));
            return;
        }

        if(srcPath.includes("$hcs$linkshare") || dstPath.includes("$hcs$linkshare")){
            //Error 6: Non valid request
            if(callback) callback(new UserFileSystemError(6));
            return;
        }
        if(srcPath.includes("$hcs$publicshare") || dstPath.includes("$hcs$publicshare")){
            //Error 6: Non valid request
            if(callback) callback(new UserFileSystemError(6));
            return;
        }
        if(srcPath.includes("$hcs$trash") || dstPath.includes("$hcs$trash")){
            //Error 6: Non valid request
            if(callback) callback(new UserFileSystemError(6));
            return;
        }

        let srcPathMachine = this.getMachinePath(srcPath);
        let dstPathMachine = this.getMachinePath(dstPath);

        createIntermediatePath(dstPathMachine.substring(0,dstPathMachine.lastIndexOf(path.sep)));
        //ncp is a module that allows to copy entire folders
        ncp(srcPathMachine,dstPathMachine,function(err){
            if(err){
                callback(err);
                return;
            }
            callback();
        }.bind(this));
    }

    copyFileSync(srcPath,dstPath){
        let pathData = this.parse(srcPath,true);
        //Cannot move hcs system folders
        if(pathData.base.startsWith("$hcs$")){
            //Error 3: Non valid path
            throw new UserFileSystemError(3);
        }

        if(srcPath.includes("$hcs$linkshare") || dstPath.includes("$hcs$linkshare")){
            //Error 6: Non valid request
            throw new UserFileSystemError(6);
        }
        if(srcPath.includes("$hcs$publicshare") || dstPath.includes("$hcs$publicshare")){
            //Error 6: Non valid request
            throw new UserFileSystemError(6);
        }
        if(srcPath.includes("$hcs$trash") || dstPath.includes("$hcs$trash")){
            //Error 6: Non valid request
            throw new UserFileSystemError(6);
        }

        let srcPathMachine = this.getMachinePath(srcPath);
        let dstPathMachine = this.getMachinePath(dstPath);

        createIntermediatePath(dstPathMachine.substring(0,dstPathMachine.lastIndexOf(path.sep)));
        //ncp is a module that allows to copy entire folders
        var ncpPromise = new Promise(function(resolve,reject){
            ncp(srcPathMachine,dstPathMachine,function(err){
                if(err){
                    reject(err);
                    return;
                }
                resolve();
            }.bind(this));
        })
        .then(function(){

        })
        .catch(function(err){
            throw err;
        });
    }

    shareFile(path,shareType,callback){
        //ShareType 1 == PublicShare, ShareType 2 == LinkShare
        if(shareType != 1 && shareType != 2){
            //Error 5: Share type not supported
            callback(new UserFileSystemError(5));
            return;
        }
        path = this.resolve(path,true);
        var machinePath = this.getMachinePath(path);
        if(!this.existsSync(path,true)){
            //Error 2: Path doesn't exists
            callback(new UserFileSystemError(2));
            return;
        }
        let stat = fs.statSync(machinePath);
        if(stat.isDirectory() && shareType == 2){
            //Error 5: Share type not supported
            callback(new UserFileSystemError(5));
            return;
        }

        let shareLoc = (shareType == 1) ? this.getPublicShareFolder(path).machinePath : this.getLinkShareFolder(path).machinePath;
        let filePathWORoot = path.substr(path.indexOf("/"));
        if(filePathWORoot.trim() == ""){
            //Error 3: Non valid path
            callback(new UserFileSystemError(3));
            return;
        }
        shareLoc += filePathWORoot;

        //If a folder has to be public shared, all of its files have to be shared
        if(stat.isDirectory() && shareType == 1){
            let files = fs.readdirSync(machinePath);
            let commonError;
            files.forEach(function(file){
                this.shareFile(path+"/"+file,1,function(err){
                    if(err) commonError = err;
                });
            }.bind(this));
            callback(commonError);
            return;
        }


        //Get database and table to store share info on the file
        let database = this.getCorrespondingDatabase(path);
        let fileTable = (database) ? database.getTable("file","ino") : undefined;
        let infoObj = fileTable.get(stat.ino,"ino") || {
            ino: stat.ino,
            path: machinePath
        };
        //If shareType is LinkShare, a link in return is needed
        var shareLink;
        if(shareType == 2){
            shareLink = `/linkshare?user=${this.username}&root=${path.substring(0,path.indexOf("/"))}&token=${stat.ino}`;
            //File info to store in the database
            infoObj.linkShared = true;
            infoObj.link = shareLink; //It's the url
            infoObj.linkSharePath = shareLoc; //Is a machine path
        }
        else{
            //File info to store in the database
            infoObj.publicShared = true;
            infoObj.publicSharePath = shareLoc; //Is a machine path
        }
        //First unlink any already present files
        try{
            fs.unlinkSync(shareLoc);
        }
        catch(err){}
        //Create all intermediate folders
        createIntermediatePath(shareLoc.substring(0,shareLoc.lastIndexOf("/")));
        //Then link it back
        try{
            fs.linkSync(machinePath,shareLoc);
            //if sharing was completed, store the file infos in the database
            fileTable.store(infoObj);
            callback(undefined,shareLink);
        }
        catch(err){
            //Error 2: Path doesn't exists
            callback(new UserFileSystemError(2));
        }
    }

    stat(path, callback) {
        path = this.getMachinePath(path);
        fs.stat(path, function (err, stat) {
            if (stat) {
                stat.isBlockDevice = stat.isBlockDevice();
                stat.isCharacterDevice = stat.isCharacterDevice();
                stat.isDirectory = stat.isDirectory();
                stat.isFIFO = stat.isFIFO();
                stat.isFile = stat.isFile();
                stat.isSocket = stat.isSocket();
                stat.isSymbolicLink = stat.isSymbolicLink();
            }
            callback(err, stat);
        });
    }

    statSync(path) {
        path = this.getMachinePath(path);
        let stat = fs.statSync(path);
        stat.isBlockDevice = stat.isBlockDevice();
        stat.isCharacterDevice = stat.isCharacterDevice();
        stat.isDirectory = stat.isDirectory();
        stat.isFIFO = stat.isFIFO();
        stat.isFile = stat.isFile();
        stat.isSocket = stat.isSocket();
        stat.isSymbolicLink = stat.isSymbolicLink();
        return stat;
    }

    /**
     * Calls a function of the node.js's fs module within the userFileSystem object
     * Transform an HCS path into a machine path
     * @param {String} functionName - The name of the function to call
     * @param {Array} leftToPathArguments - An arry of arguments the function requires befor the path argument
     * @param {String} path - The HCS path
     * @param {Array} rightToPathArguments - An arry of arguments the function requires after the path argument
     */
    callFsFunction(functionName,leftToPathArguments,path,rightToPathArguments){
        path = this.getMachinePath(path);
        let argsArray = leftToPathArguments.concat(path).concat(rightToPathArguments);
        return fs[functionName].apply(fs,argsArray);
    }




    //Helper methods

    /**
     * Resolve a path against the machine file system or the HCS file system.
     * Return undefined if the user isn't allowed on a specific path because should be like the path doesn't exists for him/her
     * @param {String} path - The path to resolve
     * @param {boolean} [hcs = false] - Wheather or not resolve the path against the HCS file system insted of the machine file system
     * @returns {String} - The full resolved path
     */
    resolve(pathString,hcs = false){
        pathString = pathString.replace(/\/+|\\+/g,"/");
        if(hcs){
            if(pathString.startsWith("./")){
                pathString = pathString.replace("./",this.currentHcsFolder+"/");
            }
            else if(pathString.startsWith("../")){
                //Removing the last "/" because it made some trouble while trying to eliminate the last object of the path
                let tempCurrFolder = this.currentHcsFolder.substring(0,this.currentHcsFolder.length-1);
                let parentDir = tempCurrFolder.substring(0,tempCurrFolder.lastIndexOf("/")+1);
                pathString = pathString.replace("../",parentDir);
            }
            //Lets check if it starts with a valid root folder, if not, try to add the current hcs folder
            let rootName = pathString.substring(0,pathString.indexOf("/"));
            //If rootName is ""(because pathString doesn't include "/"), it means that pathString is just a word, use that as a potential root
            if(rootName == ""){
                rootName = pathString;
            }
            if(!this.rootFolderList[rootName]){
                pathString = this.currentHcsFolder + "/" + pathString;
            }
        }
        else{
            pathString = path.resolve(this.currentMachineFolder, pathString); 
        }
        //Let's replace all multiple path separator with one
        return pathString.replace(/\/+|\\+/g,"/");
    }

    /**
     * A wrapper arounf the path.parse of Node.js, to support the HCS file system. It also resolves the path first
     * @param {String} pathString - The path to parse
     * @param {boolean} [hcs = false] - Wheather or not resolve the path against the HCS file system insted of the machine file system
     * @returns {Object} - The object returned by Node.js's path.resolve
     */
    parse(pathString, hcs = false){
        pathString = this.resolve(pathString,hcs);
        let parsed = path.parse(pathString);
        //HCS paths are resolved without root by Node.js
        if(hcs && parsed.root == ''){
            let i = pathString.indexOf("/");
            if(i == -1){
                parsed.root = parsed.base;
            }
            else{
                parsed.root = pathString.substring(0,i);
            }
        }
        return parsed;
    }

    /**
     * Transform a machine path into an HCS path, if the user can see this path
     * @param {String} pathString - The machine path that gets transformed into an HCS path
     * @returns {String} - The HCS path
     */
    getHCSPath(pathString){
        var pathString = this.resolve(pathString);
        for(let i in this.rootFolderList){
            let folder = this.rootFolderList[i];
            if(pathString.includes(folder.path)){
                let retPath = pathString.replace(folder.path,folder.name+"/");
                return retPath.replace(/\\+|\/+/g,"/");
            }
        }
    }

    /**
     * Transform an HCs path into a machine path, if the user can see this path
     * @param {String} pathString - The HCS path that gets transformed into a machine path
     * @returns {String} - The machine path
     */
    getMachinePath(pathString){
        pathString = this.resolve(pathString,true);
        let firstSlash = pathString.indexOf("/");
        //If firstSlash == -1, then the pathString contains just the rootfolder name
        let rootFolderName = (firstSlash != -1) ? pathString.substring(0,firstSlash) : pathString;
        //If the user is not allowed on this root folder, return undefined
        if(!this.rootFolderList[rootFolderName]){
            return;
        }
        let rootFolderPath = this.rootFolderList[rootFolderName].path;
        let folderPath = (firstSlash != -1) ? pathString.substr(firstSlash+1) : "";
        return path.resolve(rootFolderPath, folderPath);
    }



    /**
     * A wrapper arounf the fs.existsSync of Node.js, to support the HCS file system. It also resolves the path first
     * If the path exists but this user is not allowed on it, this will return false
     * @param {String} pathString - The path to check
     * @param {boolean} [hcs = false] - Wheather or not resolve the path against the HCS file system insted of the machine file system 
     * @returns {boolean} - True if the path exists, false otherwise
     */
    existsSync(pathString,hcs = false){
        pathString = this.resolve(pathString,hcs);
        //If hcs = true, transform the hcs path into a machine path, only if the user has access to it
        if(hcs){
            let pathData = this.parse(pathString,hcs);
            if(this.rootFolderList[pathData.root]){
                pathString = this.getMachinePath(pathString);
            }
            else{
                return false;
            }
        }
        return fs.existsSync(pathString);
    }

    getCorrespondingDatabase(pathString){
        let root = this.parse(pathString,true).root;
        if(this.rootFolderList[root]){
            return this.rootFolderList[root].database;
        }
    }

    /**
     * Gets the trash folder for a specific path
     * @param {String} pathString - An HCS path, the root folder gets extrapolated and the relative trash folder is returned
     * @returns {HCSDirectory} - The trash folder
     */
    getTrashFolder(pathString) {
        pathString = this.resolve(pathString, true);
        let pathData = this.parse(pathString, true);
        let finalPath = pathData.root + "/$hcs$trash";
        let ret = new HCSDirectory(this.getMachinePath(finalPath), finalPath, 0, "Trash");
        let adding = "";
        let addingFile = "";
        let correspondingAdding = "";
        //If the path is part of this folder, fill in the insidePath and insideFolderPath correctelly
        if(pathString.includes(ret.path)){
            adding = pathString.replace(ret.path,"");
            addingFile = adding;
            if(this.statSync(pathString).isFile){
                adding  = adding.replace(pathData.base,"");
            }
            correspondingAdding = addingFile;
        }
        else{
            correspondingAdding = pathString.replace(pathData.root,"");
        }
        //InsideFolderPath and insidePath carry the folder path and the entire path of whatever was passed as pathString in case is part of this special folder
        ret.insideFolderPath =  this.resolve(ret.path + "/" + adding,true);
        ret.insidePath = this.resolve(ret.path + "/" + addingFile,true);
        ret.correspondingPath = this.resolve(ret.path + "/" + correspondingAdding,true);
        return ret;
    }

    getPublicShareFolder(pathString) {
        pathString = this.resolve(pathString, true);
        let pathData = this.parse(pathString, true);
        let finalPath = pathData.root + "/$hcs$publicshare";
        let ret = new HCSDirectory(this.getMachinePath(finalPath), finalPath, 0, "Public Share");
        let adding = "";
        let addingFile = "";
        let correspondingAdding = "";
        //If the path is part of this folder, fill in the insidePath and insideFolderPath correctelly
        if(pathString.includes(ret.path)){
            adding = pathString.replace(ret.path,"");
            addingFile = adding;
            if(this.statSync(pathString).isFile){
                adding  = adding.replace(pathData.base,"");
            }
            correspondingAdding = addingFile;
        }
        else{
            correspondingAdding = pathString.replace(pathData.root,"");
        }
        //InsideFolderPath and insidePath carry the folder path and the entire path of whatever was passed as pathString in case is part of this special folder
        ret.insideFolderPath =  this.resolve(ret.path + "/" + adding,true);
        ret.insidePath = this.resolve(ret.path + "/" + addingFile,true);
        ret.correspondingPath = this.resolve(ret.path + "/" + correspondingAdding,true);
        return ret;
    }

    getLinkShareFolder(pathString) {
        pathString = this.resolve(pathString, true);
        let pathData = this.parse(pathString, true);
        let finalPath = pathData.root + "/$hcs$linkshare";
        let ret = new HCSDirectory(this.getMachinePath(finalPath), finalPath, 0, "Link Share");
        let adding = "";
        let addingFile = "";
        let correspondingAdding = "";
        //If the path is part of this folder, fill in the insidePath and insideFolderPath correctelly
        if(pathString.includes(ret.path)){
            adding = pathString.replace(ret.path,"");
            addingFile = adding;
            if(this.statSync(pathString).isFile){
                adding  = adding.replace(pathData.base,"");
            }
            correspondingAdding = addingFile;
        }
        else{
            correspondingAdding = pathString.replace(pathData.root,"");
        }
        //InsideFolderPath and insidePath carry the folder path and the entire path of whatever was passed as pathString in case is part of this special folder
        ret.insideFolderPath =  this.resolve(ret.path + "/" + adding,true);
        ret.insidePath = this.resolve(ret.path + "/" + addingFile,true);
        ret.correspondingPath = this.resolve(ret.path + "/" + correspondingAdding,true);
        return ret;
    }


}

/**
 * Create an instance of UserFileSystem with the data inside object
 * @param {Object} object - The object with a UserFileSystem properties
 * @returns {UserFileSystem} - Returns the UserFileSystem instance
 */
function createFromBackupObject(object){
    var rootFolders = [];
    for(let rFolder of object.plainRootFolders){
        rootFolders.push(new RootFolder( rFolder.name, rFolder.path, rFolder.all, rFolder.usersAccepted, rFolder.usersNotAccepted ));
    }
    let ufs = new UserFileSystem(object.username,rootFolders);
    ufs.currentHcsFolder = object.currentHcsFolder;
    ufs.currentMachineFolder = object.currentMachineFolder;
    return ufs;
}

function cloneUserFileSystem(ufs){
    if(!(ufs instanceof UserFileSystem)){
        throw new Error("ufs has to be a UserFileSystem");
    }

    let newUfs = new UserFileSystem(ufs.username,ufs.plainRootFolders,ufs.databases);
    newUfs.currentHcsFolder = ufs.currentHcsFolder;
    newUfs.currentMachineFolder = ufs.currentMachineFolder;

    return newUfs;
}

function createIntermediatePath(pathString) {
    pathString = path.resolve(pathString);

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

function deleteRecursive(path,callback) {
    if (fs.existsSync(path)) {
        if(fs.statSync(path).isDirectory()){
            try{
                fs.readdirSync(path).forEach(function (file, index) {
                    var curPath = path + "/" + file;
                    deleteRecursiveSync(curPath);
                });
            }
            catch(err){
                callback(err);
                return;
            }
            fs.rmdir(path,callback);
        }
        else{
            fs.unlink(path,callback);
        }
    }
    else{
        //Error 2: Path doesn't exists
        callback(new UserFileSystemError(2));
    }
};

function deleteRecursiveSync(path) {
    if (fs.existsSync(path)) {
        if(fs.statSync(path).isDirectory()){
            fs.readdirSync(path).forEach(function (file, index) {
                var curPath = path + "/" + file;
                deleteRecursiveSync(curPath);
            });
            fs.rmdirSync(path);
        }
        else{
            fs.unlinkSync(path);
        }
        
    }
};

class UserFileSystemError{

    //errorNumber is one in this list
    //0: Error wrapper for another node.js error
    //1: No root folders available
    //2: Path doesn't exists
    //3: Non valid path
    //4: Folder path required
    //5: Share type not supported
    //6: Non valid request
    constructor(errorNumber, err){
        this.errorNumber = errorNumber;
        switch(errorNumber){
            case 0:
                this.name = "Node.js error";
                this.message = "There has been an error not related to the user file system"
                this.error = err;
            case 1:
                this.name = "No root folders available";
                this.message = "There aren't any root folders available, set at least one root folder per user";
                break;
            case 2:
                this.name = "Path doesn't exists";
                this.message = `This path (${err}) doesn't exist or is not visible to this user`;
                break;
            case 3:
                this.name = "Non valid path";
                this.message = `This path (${err}) is not valid, malformed or corrupted`;
                break;
            case 4:
                this.name = "Folder path required";
                this.message = `Is required a folder path, ${err} is a file path`;
                break;
            case 5:
                this.name = "Share type not supported";
                this.message = "This share type is not supported";
                break;
            case 6:
                this.name = "Non valid request";
                this.message = "The request wan not valid or processable";
                break;
        }
    }

    
}

module.exports = UserFileSystem;
module.exports.createFromBackupObject = createFromBackupObject;
module.exports.cloneUserFileSystem = cloneUserFileSystem;