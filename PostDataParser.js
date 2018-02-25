var fs = require("fs");
var path = require("path");
var os = require("os");
var Busboy = require("busboy");
const uuidv4 = require('uuid/v4');

var tempDataFolder = path.join(__dirname, "PostDataParser");

var getMiddleware = function(options){
    fs.mkdir(tempDataFolder,(err)=>{
        if(err && err.code != "EEXIST"){
            console.log("PostDataParser error:");
            console.log(err);
        }
    });
    return function(req, res, next){
        parseBody(options,req,res,next);
    }
}

var parseBody = function (options = {}, req, res, next) {
    if(!req.headers["content-type"]){
        next();
        return;
    }

    options.headers = req.headers;
    var busboy = new Busboy(options);
    busboy.on('file', function (fieldname, stream, filename, encoding, mimetype) {
        console.log(`Receiving file ${filename}[${fieldname}]`);
        req.files = req.files || {};
        var tempPath = path.join(tempDataFolder, (uuidv4()+fieldname));
        var wStream = fs.createWriteStream(tempPath);

        var inDownloadTimer;
        //Set a timeout every 2min, if no data is received in 2min, the download was interrupted
        inDownloadTimer = setTimeout(function(){
            fs.unlinkSync(tempPath);
            wStream.close();
        },1000*60*2);
        stream.on("data",function(){
            console.log("Data of " + filename);
            //Set a timeout every 2min, if no data is received in 2min, the download was interrupted
            clearTimeout(inDownloadTimer);
            inDownloadTimer = setTimeout(function(){
                console.log("Data missing")
                fs.unlinkSync(tempPath);
                wStream.close();
            },1000*60*2);
        });

        stream.pipe(wStream);
        stream.on('end', function () {
            //The file was downloaded, so clearing the timeout
            clearTimeout(inDownloadTimer);

            let value = new PostFile(1000*60*60,tempPath,filename,mimetype,encoding);
            //If the field doesn't exists, fill it in
            if (!req.files[fieldname]) {
                req.files[fieldname] = value;
            }
            //If it does and is an array, just push the new value
            else if (Array.isArray(req.files[fieldname])) {
                req.files[fieldname].push(value);
            }
            //If it exists but is just a value, make it into an array
            else {
                req.files[fieldname] = [req.files[fieldname], value];
            }
            //Lets close the stream
            wStream.end();
        });

    });
    busboy.on('field', function (fieldname, value, fieldnameTruncated, valTruncated) {
        req.body = req.body || {};
        //If the field doesn't exists, fill it in
        if(!req.body[fieldname]){
            req.body[fieldname] = value;
        }
        //If it does and is an array, just push the new value
        else if(Array.isArray(req.body[fieldname])){
            req.body[fieldname].push(value);
        }
        //If it exists but is just a value, make it into an array
        else{
            req.body[fieldname] = [req.body[fieldname], value];
        }
    });
    busboy.on('finish', function () {
        next();
    });

    req.pipe(busboy);  
}

class PostFile {

    constructor(lifetime,tempPath,name,mimeType,encoding){
        if(Buffer.isBuffer(tempPath)){
            this.buffer = tempPath;
        }
        else{
            this.tempPath = tempPath;
            this.path = tempPath;
        }
        this.name = name;
        this.mimeType = mimeType;
        this.encoding = encoding;

        this.deleteFile = this.deleteFile.bind(this);
        if(!this.buffer){
            lifetime = lifetime || (1000*60*60);
            this.timer = setTimeout(this.deleteFile.bind(this),lifetime);
        }
        
    }

    getBuffer(){
        if(this.buffer){
            return this.buffer;
        }
        else{
            clearTimeout(this.timer);
            return fs.readFileSync(this.path);
        }
        
    }

    move(newPath,callback){
        if(this.buffer){
            fs.writeFileSync(newPath,this.buffer);
            return true;
        }
        else{
            if(fs.existsSync(this.tempPath)){
                fs.rename(this.tempPath,newPath,function(err){
                    clearTimeout(this.timer);
                    this.path = newPath;
                    callback(err);
                }.bind(this));
                return true;
            }
            return false;
        }
    }

    deleteFile(){
        if(fs.existsSync(this.tempPath)){
            fs.unlink(this.tempPath,(err) => {});
        }
    }

}



module.exports = getMiddleware;