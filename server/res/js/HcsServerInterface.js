class HcsServerInterface {

    constructor(onload){
        this.rootFolderList = [];        
        this.currentFolder = "./";

        // this.requestRootFolderList(function(err,folderList){
        //     this.rootFolderList = folderList;
        // }.bind(this));
        // this.changeCurrentFolder("./",function(err,folder){
        //     if(err) throw err;
        //     this.currentFolder = folder;
        // }.bind(this));

        let protocol = (location.protocol.includes("https")) ? "wss://" : "ws://";
        this.webSocket = new WebSocket(protocol + document.location.host);
        this.webSocket.events = {};
        this.webSocket.on = function(event,callback){
            if(typeof event != "string"){
                throw new Error("Event must be a string");
            }
            if(typeof callback != "function"){
                throw new Error("Callback must be a function");
            }
            if(!this.webSocket.events[event]){
                this.webSocket.events[event] = [];
            }
            this.webSocket.events[event].push(callback);
        }.bind(this);
        this.webSocket.removeOn = function(event,callback){
            if(typeof event != "string"){
                throw new Error("Event must be a string");
            }
            if(typeof callback != "function"){
                throw new Error("Callback must be a function");
            }
            if(this.webSocket.events[event]){
                let i = this.webSocket.events[event].indexOf(callback);
                this.webSocket.events[event].splice(i,1);
            }
        }.bind(this);

        // Listen for messages
        this.webSocket.addEventListener('message', function (event) {
            let data = JSON.parse(event.data);
            if(this.webSocket.events[data.req]){
                this.webSocket.events[data.req].forEach(function(callback){
                    callback(data);
                });
            }
            console.log('Message from server ');
            console.log(data);
        }.bind(this));

        /*
        //Legacy code to request current folder and
        var rootFolderListPromise = new Promise(function(resolve,reject){

            this.requestRootFolderList(function(err,folderList){
                if(!err){
                    this.rootFolderList = folderList;
                    resolve(folderList);
                }
                else{
                    reject(err);
                }
            }.bind(this));

        }.bind(this));

        var currentFolderPromise = new Promise(function(resolve,reject){

            this.changeCurrentFolder("./",function(err,folder){
                if(err){
                    reject(err);
                }
                else{
                    this.currentFolder = folder;
                    resolve(folder);
                }
            }.bind(this));

        }.bind(this));

        Promise.all([rootFolderListPromise,currentFolderPromise])
        .then(function(){
            if(typeof onload == "function") onload(this);
        }.bind(this))
        .catch((err) => {
            throw err;
        });
        */

        //Recover info put by the server in the html
        this.currentFolder = document.querySelector("#serverInfo #currentFolder").innerText;
        this.rootFolderList = JSON.parse(document.querySelector("#serverInfo #rootFoldersList").innerText);

        if(typeof onload == "function") onload(this);

    }

    changeCurrentFolder(path,callback){
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var self = this;
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                //Save the current folder
                self.currentFolder = this.responseText;
                console.log("Folder changed to " + this.responseText);
                if(callback) callback(undefined,this.responseText);
            }
            else if(this.readyState == 4 && this.status == 404){
                //Save the current folder
                this.currentFolder = this.responseText;
                if(callback) callback(this.status,this.responseText);
            }
            else if(this.readyState == 4 && (this.status != 200 || this.status != 404)){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=changefolder&path=${path}`, true);
        xhttp.send();
    }

    requestFileTree(path,level = 1,callback) {
        if(typeof level == "function"){
            callback = level;
            level = 1;
        }
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var fileTree = JSON.parse(xhttp.responseText);
                if(callback) callback(undefined,fileTree);
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.response);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=filetree&path=${path}&level=${level || 1}`, true);
        xhttp.send();
    }

    requestSearchFileTree(path,searchString,callback) {
        if(typeof level == "function"){
            callback = level;
            level = 1;
        }
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var fileTree = JSON.parse(xhttp.responseText);
                if(callback) callback(undefined,fileTree);
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.response);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=search&path=${path}&match=${searchString}`, true);
        xhttp.send();
    }

    requestFile(path,loadingCallback,doneCallback){
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        //Setting the responseType makes the object treat the request as the type specified
        xhttp.responseType = "blob";
        xhttp.addEventListener("progress", function (event) {
            if (event.lengthComputable) {
                var percentComplete = event.loaded / event.total;
                if(loadingCallback) loadingCallback(percentComplete, event.loaded, event.total);
            }
        });
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(doneCallback) doneCallback(undefined,this.response);
            }
            else if(this.readyState == 4 && this.status != 200){
                if(doneCallback) doneCallback(this.response);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=file&path=${path}`, true);
        xhttp.send();
    }

    requestMultiFiles(paths){
        if(!Array.isArray(paths)){
            throw "Paths needs to be an array of strings";
        }
        paths = JSON.stringify(paths);
        document.location = "/files?req=multifile&path=" + paths;
    }

    requestFileStat(path,callback){
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var stat = JSON.parse(xhttp.responseText);
                if(callback) callback(undefined,stat);
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.response);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=stat&path=${path}`, true);
        xhttp.send();
    }

    requestFolderSize(path,callback){
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(callback) callback(undefined,this.responseText);
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=calcfoldersize&path=${path}`, true);
        xhttp.send();
    }

    requestRootFolderList(callback){
        var self = this;
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                self.rootFolderList = JSON.parse(this.responseText);
                if(callback) callback(undefined,self.rootFolderList);
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        xhttp.open("GET", `/files?req=rootfolderlist&path=no-need`, true);
        xhttp.send();
    }

    requestDeleteFile(path,callback){
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(callback) callback();
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=delete&path=${path}`, true);
        xhttp.send();
    }

    requestCreateFolder(path,callback){
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(callback) callback();
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=createfolder&path=${path}`, true);
        xhttp.send();
    }

    //newPath needs to include the name of the file
    requestMoveFile(path,newPath,callback){
        if(typeof path != "string" || typeof newPath != "string"){
            throw "Path and newPath need to be strings";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(callback) callback();
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=move&path=${path}&newpath=${newPath}`, true);
        xhttp.send();
    }

    requestCopyFile(path,newPath,callback){
        if(typeof path != "string" || typeof newPath != "string"){
            throw "Path and newPath need to be strings";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(callback) callback();
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=copy&path=${path}&newpath=${newPath}`, true);
        xhttp.send();
    }

    requestTrashFolder(path,callback){
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(callback) callback(undefined,JSON.parse(this.responseText));
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=trashfolder&path=${path}`, true);
        xhttp.send();
    }

    requestPublicShareFolder(path,callback){
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(callback) callback(undefined,JSON.parse(this.responseText));
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=publicsharefolderinfo&path=${path}`, true);
        xhttp.send();
    }

    requestLinkShareFolder(path,callback){
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(callback) callback(undefined,JSON.parse(this.responseText));
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=linksharefolderinfo&path=${path}`, true);
        xhttp.send();
    }

    shareFilePublic(path,callback){
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(callback) callback(undefined);
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=publicsharefile&path=${path}`, true);
        xhttp.send();
    }

    shareFileLink(path,callback){
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(callback) callback(undefined,this.responseText);
            }
            else if(this.readyState == 4 && this.status != 200){
                if(callback) callback(this.responseText);
            }
        };
        //Encode the path so that is parsed correctelly server-side
        path = encodeURIComponent(path);
        xhttp.open("GET", `/files?req=linksharefile&path=${path}`, true);
        xhttp.send();
    }

    uploadFile(path,files,loadingCallback,doneCallback){
        if(!(files instanceof Array) && !(files instanceof FileList)){
            files = [files];
        }
        if(typeof path != "string"){
            throw "Path needs to be a string";
        }
        if(files.length < 1){
            throw "Is required at least one file";
        }
        let formData = new FormData();
        formData.append("path",path);
        for(let file of files){
            formData.append("files",file);
        }

        var xhttp = new XMLHttpRequest();
        xhttp.lastLoadedProgress = 0;
        xhttp.lastTimeProgress = 0;
        xhttp.progressUpdateCount = 0;
        xhttp.sumUploadSpeed = 0;
        xhttp.upload.onprogress = function (event) {
            if (event.lengthComputable) {
                //Calc the percentage uploded
                var percentComplete = event.loaded / event.total;

                //Calc the upload speed and the remaining time
                let now = performance.now();
                let time = (now - xhttp.lastTimeProgress)/1000;
                let bytes = event.loaded - xhttp.lastLoadedProgress;
                let bytePerSecond = bytes / time;
                xhttp.sumUploadSpeed = xhttp.sumUploadSpeed + bytePerSecond;
                xhttp.progressUpdateCount++;
                var uploadSpeed = xhttp.sumUploadSpeed/xhttp.progressUpdateCount;
                let remainingData = event.total - event.loaded;
                var remainingTime = remainingData / uploadSpeed;
                //Updating info for next callback
                xhttp.lastTimeProgress = now;
                xhttp.lastLoadedProgress = event.loaded;

                if(loadingCallback) loadingCallback(percentComplete, event.loaded, event.total, uploadSpeed, remainingTime);
            }
        }
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                if(doneCallback) doneCallback(undefined,this.responseText);
            }
            else if(this.readyState == 4 && this.status != 200){
                if(doneCallback) doneCallback(this.response);
            }
        };
        xhttp.open("POST", "/files", true);
        xhttp.send(formData);
        xhttp.lastTimeProgress = performance.now();

    }
}