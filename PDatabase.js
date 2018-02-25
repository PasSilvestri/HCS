var fs = require("fs");
var pathlib = require("path");

class  PDatabase{

    /**
     * Creates a database in the specified folder
     * @param {String} databaseFolder - The folder where to store the database
     */
    constructor(databaseFolder){
        this.databaseFolder = databaseFolder;
        this.tables = {};
    }

    /**
     * Creates the table if it doesn't exists
     * @param {String} name - The name of the table
     * @param {String} key - The master key of the table
     * @returns {PTable} - The requested table
     */
    createTable(name,key){
        if(this.tables[name]){
            throw "Table already exists";
        }
        var pt = new PTable(false, name, key, this.databaseFolder);
        this.tables[name] = pt;
        return pt;
    }

    /**
     * Load the table from memory. Can be used also for reloading
     * @param {String} name - The name of the table
     * @param {String} key - The master key of the table
     * @returns {PTable} - The requested table
     */
    loadTable(name){
        var pt = new PTable(true, name, undefined, this.databaseFolder);
        this.tables[name] = pt;
        return pt;
    }

    /**
     * Retrieve the table, first from the cache if it exists, then trys to load it up, and if doesn't exists on disk either, creates it
     * @param {String} name - The name of the table
     * @param {String} key - The master key of the table
     * @returns {PTable} - The requested table
     */
    getTable(name,key){
        if(this.tables[name]){
            return this.tables[name];
        }

        let ret;
        try{
            ret = this.loadTable(name);
        }
        catch(err){
            ret = this.createTable(name,key);
        }
        return ret;
    }

}

class PTable {

    constructor(load,name,key,path){
        this.path = pathlib.join(path,name+".ptab");
        this.name = name;
        this.key = key;
        //data will contain all the columns
        this.data = {};
        
        //If load is true, load the table from file
        if(load){
            let tab = JSON.parse(fs.readFileSync(this.path));
            this.key = tab.key;
            //Scroll through all the objects in the stored data, create all the columns with the parameters of each object
            //and put the object inside that column
            for(let object of tab.data ){
                for(let param of Object.keys(object) ){
                    if(!this.data[param]){
                        this.data[param] = {};
                    }
                    //If there are no object with that parameter stored in the table, put object in
                    if(!this.data[param][object[param]]){
                        this.data[param][object[param]] = object;
                    }
                    //Else if it exists and is an array, push the object in
                    else if(Array.isArray( this.data[param][object[param]] )){
                        this.data[param][object[param]].push(object);
                    }
                    //Else, if it exists but is not an array means is just one object, transform it into an array
                    else{
                        this.data[param][object[param]] = [this.data[param][object[param]],object];
                    }
                }
            }
        }
        else{
            //If creating the table from scratch, let's create the master column
            if(key){
                this.data[key] = {};
            }
            else{
                throw "Master key required to create the database";
            }
        }
    }

    add(object){
        //Recreating the object so there are no pointers inside the database
        object = JSON.parse(JSON.stringify(object));
        if(!object || !object[this.key]){
            throw "Object needs to be defined and have " + this.key + " parameter";
        }
        if(this.data[this.key] && this.data[this.key][object[this.key]]){
            throw `Object with same unique key (${object[this.key]}) already exists`
        }
        for(let param of Object.keys(object) ){
            if(!this.data[param]){
                this.data[param] = {};
            }
            //If there are no object with that parameter stored in the table, put object in
            if(!this.data[param][object[param]]){
                this.data[param][object[param]] = object;
            }
            //Else if it exists and is an array, push the object in
            else if(Array.isArray( this.data[param][object[param]] )){
                this.data[param][object[param]].push(object);
            }
            //Else, if it exists but is not an array means is just one object, transform it into an array
            else{
                this.data[param][object[param]] = [this.data[param][object[param]],object];
            }
        }
        //Writing the table on disk
        setImmediate(function(){
            let mixedObjs = Object.values(this.data[this.key]);
            var allObjects = [];
            allObjects = allObjects.concat(...mixedObjs);
                
            var tab = {
                name: this.name,
                key: this.key,
                data: allObjects
            }
            var tableString = JSON.stringify(tab);
            fs.writeFileSync(this.path,tableString);
        }.bind(this));
    }

    /**
     * Add the object to the database if not present, override the previously added object with the same key
     * The object need to have a unique key, passed as parameter with the same name as the key used to create this table
     * @param {Object} object - The object to store
     */
    store(object){
        if(!object || !object[this.key]){
            throw "Object needs to be defined and have " + this.key + " parameter";
        }
        //If the object doesn't exists in the table, add it
        if(!this.data[this.key] || !this.data[this.key][object[this.key]]){
            this.add(object);
        }
        //Else, update all reference
        else{
            this.remove(object[this.key]);
            this.add(object);
            /*
            //Recreating the object so there are no pointers inside the database
            object = JSON.parse(JSON.stringify(object));

            //Remove all the old refs
            let oldObj = this.data[this.key][object[this.key]];
            for(let param of Object.keys(oldObj) ){
                let d = this.data[param][oldObj[param]];

                if(Array.isArray(d)){
                    for(let i in d){
                        if(d[i][this.key] == oldObj[this.key]){
                            d.splice(i,1);
                            break;
                        }
                    }
                }
                else{
                    delete this.data[param][oldObj[param]];
                }
            }

            //Create the new refs
            for(let param of Object.keys(object) ){
                if(!this.data[param]){
                    this.data[param] = {};
                }
                //If there are no object with that parameter stored in the table, put object in
                if(!this.data[param][object[param]]){
                    this.data[param][object[param]] = object;
                }
                //Else if it exists and is an array, push the object in
                else if(Array.isArray( this.data[param][object[param]] )){
                    this.data[param][object[param]].push(object);
                }
                //Else, if it exists but is not an array means is just one object, transform it into an array
                else{
                    this.data[param][object[param]] = [this.data[param][object[param]],object];
                }
            }

            */
        }
    }

    remove(keyValue){
        //Remove all the old refs
        let oldObj = this.data[this.key][keyValue];
        //Return if object not present in the table
        if(!oldObj) return;
        for(let param of Object.keys(oldObj) ){
            let d = this.data[param][oldObj[param]];

            if(Array.isArray(d)){
                for(let i in d){
                    if(d[i][this.key] == oldObj[this.key]){
                        d.splice(i,1);
                        break;
                    }
                }
            }
            else{
                delete this.data[param][oldObj[param]];
            }
        }
    }

    get(value, key){
        if(!key){
            key = this.key;
        }
        //The double call to JSON is done to have a deep copy of the object (the database doesn't store objects with methods)
        return (this.data[key] && this.data[key][value]) ? JSON.parse(JSON.stringify(this.data[key][value])) : undefined;
    }


}




module.exports = PDatabase;