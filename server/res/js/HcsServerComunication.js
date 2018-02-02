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

    requestMoveFile(path,newPath,callback){
        if(typeof path != "string" || newPath != "string"){
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
        xhttp.upload.onprogress = function (event) {
            if (event.lengthComputable) {
                var percentComplete = event.loaded / event.total;
                if(loadingCallback) loadingCallback(percentComplete, event.loaded, event.total);
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

    }
}