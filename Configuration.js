var fs = require("fs");
var pathlib = require("path");
var bcrypt = require("bcryptjs");

class Configuration {

    /**
     * Creates a configuration for the server instance
     * @param {String} confData - The content of the configuration file
     */
    constructor(confData){
        this.userList = {};
        this.port = 80;
        this.rootFolderList = {};
        this.plugins = [];
        this.admin = new User("Admin",bcrypt.hashSync("Admin"),"hash");
        if(confData) this.parseConfig(confData);
        //If no user has been  configured, the standard user is used
        if(Object.keys(this.userList).length == 0){
            let c = new User();
            this.userList[c.name] = c;
        }
        //If no root folder has been configured, the standard rootfolder is used
        if(Object.keys(this.rootFolderList).length == 0){
            let f = new RootFolder();
            this.rootFolderList[f.name] = f;
        }
    }

    /**
     * Parses the configuration from the configuration file content
     * @param {String} confData - The content of the configuration file
     */
    parseConfig(confData = ""){
        let lines = confData.toString().split(`\n`);
        for(let i=0; i<lines.length; i++){
            let line = lines[i].trim().replace(/\s+/g," ").replace(/\s*=\s*/g,"=").replace(/-\s*/g,"-");
            if(line.startsWith("#") || line.length == 0){
                //Is just a comment or an empry line, continue
                continue;
            }
            let propsString = line.split(" ");
            if(propsString.length < 2){
                throw new MalformedConfigExcpetion(i+1, "At least one option required");
            }
            let prop = {property: propsString[0].toLowerCase()};
            for(let c=1; c<propsString.length; c++){
                let opt = propsString[c];
                let optName = "default";
                let optValue = opt;
                if(opt.startsWith("-")){
                    if(opt.includes("=")){
                        optName = opt.substring(1,opt.indexOf("=")).toLowerCase();
                        optValue = opt.substring(opt.indexOf("=")+1);
                    }
                    else{
                        optName = opt.substring(1).toLowerCase();
                        optValue = true;
                    }
                }
                //If option already exists means that there can be more values for that option, so let's make it into an array
                if(prop[optName]){
                    prop[optName] = [prop[optName]];
                    prop[optName].push(optValue);
                }
                else{
                    prop[optName] = optValue;
                }
            }

            switch (prop.property) {
                case "port":
                    this.port = prop.default;                    
                    break;
                case "user":
                    if(!prop.name){
                        throw new MalformedConfigExcpetion(i+1, "User name missing");
                    }
                    if(!prop.pass){
                        throw new MalformedConfigExcpetion(i+1, "User password missing");
                    }
                    let u = new User(prop.name, prop.pass, prop.passhashed ? "hash" : "clear");
                    if(this.userList[u.name]){
                        throw new MalformedConfigExcpetion(i+1, `Two users with name "${u.name}", every user needs a different name`);
                    }
                    this.userList[u.name] = u;
                    break;
                case "rootfolder":
                    if(!prop.name){
                        throw new MalformedConfigExcpetion(i+1, "Root folder name missing");
                    }
                    if(!prop.path){
                        throw new MalformedConfigExcpetion(i+1, "Root folder path missing");
                    }
                    let f = new RootFolder(prop.name,prop.path,prop.all,prop.user,prop.but);
                    if(this.rootFolderList[f.name]){
                        throw new MalformedConfigExcpetion(i+1, `Two root folders with name "${f.name}", every root folder needs a different name`);
                    }
                    this.rootFolderList[f.name] = f;
                    break;
                case "admin":
                    this.admin = new User(prop.name || "Admin", prop.pass || bcrypt.hashSync("Admin"),  prop.passhashed ? "hash" : (prop.pass ? "clear" : "hash") );
                    break;
                case "plugin":
                    this.plugins.push(prop.default);
                    break;
                case "tls":
                    if(!prop.cert){
                        throw new MalformedConfigExcpetion(i+1, "Tls certificate path missing");
                    }
                    if(!prop.key){
                        throw new MalformedConfigExcpetion(i+1, "Tls key path missing");
                    }
                    this.tls = {
                        cert: prop.cert,
                        key: prop.key,
                        port: prop.port || 443,
                        redirect: port.redirect
                    };
                    break;
                default:
                    throw new MalformedConfigExcpetion(i+1, `Unidentified property (add "#" for comment lines)`);
            }
        }
    }

    getUserArray(){
        return Object.values(this.userList);
    }

    getRootFolderArray(){
        return Object.values(this.rootFolderList);
    }


}

class User {

    constructor(name = "User", password = "HCS-Password", passType = "clear"){
        this.name = name;
        this.password = password;
        this.passType = passType.trim().toLowerCase();
    }

    checkPassword(pass){
        if(this.passType = "hash"){
            return bcrypt.compareSync(pass,this.password);
        }
        else if(pass == this.password){
            return true;
        }
        return false;
    }

}

class RootFolder {

    constructor(name = "Root", path, all = true, usersAccepted = [], usersNotAccepted = []){
        this.name = name;
        this.path = pathlib.resolve( path || pathlib.join(__dirname,"root-folder") ).replace(/\\/g,"/");
        this.all = all;
        this.usersAccepted = usersAccepted;
        this.usersNotAccepted = usersNotAccepted;
        //If some users have selected or rejected, not all users are accepted in this rootFolder, so this.all has to be false
        if(this.usersAccepted.length != 0){
            this.all = false;
        }
        if(this.usersAccepted.length == 0){
            this.all = true;
        }
    }

    isUserAllowed(username){
        if(this.usersNotAccepted.includes(username)){
            return false;
        }
        else if(this.all || this.usersAccepted.includes(username)){
            return true;
        }
    }
}

class MalformedConfigExcpetion {

    constructor(line, message){
        this.line = line;
        this.message = message || "Unknown";
    }

    toString(){
        return `Malformed config file at line ${this.line}: ${this.message}`;
    }

}

module.exports = Configuration;
module.exports.RootFolder = RootFolder;
module.exports.User = User;
