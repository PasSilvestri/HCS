class FileTree{

    constructor(machinePath, path){
        this.machinePath = machinePath;
        this.path = path;
        this.dirList = [];
        this.fileList = [];
        this.linkList = [];
    }

    addDirectory(dir){
        this.dirList.push(dir);
    }

    addFile(file){
        this.fileList.push(file);
    }

    addLink(link){
        this.linkList.push(link);
    }

    getDirList(){
        return this.dirList;
    }

    getFileList(){
        return this.fileList;
    }

    getLinkList(){
        return this.linkList;
    }

    setError(err){
        this.error = err;
    }

    merge(fileTree){
        this.dirList = this.dirList.concat(fileTree.dirList);
        this.fileList = this.fileList.concat(fileTree.fileList);
        this.linkList = this.linkList.concat(fileTree.linkList);
    }

}

class HCSDirectory {

    constructor(machinePath,path,size,type = "General",info = {}){        
        this.class = "HCSDirectory";
        this.classIndex = 1;
        this.machinePath = machinePath;
        this.path = path;
        let nameParts = path.split(/\\+|\/+/g);
        this.name = nameParts[nameParts.length -1];
        this.size = size;
        this.type = type;
        
        for(let par in info){
            this[par] = info[par];
        }
    }

    setFileTree(fileTree){
        this.fileTree = fileTree;
    }

}

class HCSFile {
    constructor(machinePath,path,size,type,lastModified,info = {}){
        this.class = "HCSFile";
        this.classIndex = 2;
        this.machinePath = machinePath;
        this.path = path;
        let nameParts = path.split(/\\+|\/+/g);
        this.name = nameParts[nameParts.length -1];
        this.size = size;
        this.type = type;
        this.lastModified = lastModified;

        for(let par in info){
            this[par] = info[par];
        }
    }

    setBuffer(buffer){
        this.buffer = buffer;
    }
}

class HCSSymLink {
    constructor(machinePath,path, info = {}){
        this.class = "HCSSymLink";
        this.classIndex = 3;
        this.machinePath = machinePath;
        this.path = path;
        let nameParts = path.split(/\\+|\/+/g);
        this.name = nameParts[nameParts.length -1];
        
        for(let par in info){
            this[par] = info[par];
        }
    }
}

module.exports.HCSFile = HCSFile;
module.exports.HCSDirectory = HCSDirectory;
module.exports.HCSSymLink = HCSSymLink;
module.exports.FileTree = FileTree;