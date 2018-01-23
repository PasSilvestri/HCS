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

}

class HCSDirectory {

    constructor(machinePath,path,size,type = "General"){        
        this.class = "HCSDirectory";
        this.classIndex = 1;
        this.machinePath = machinePath;
        this.path = path;
        let nameParts = path.split(/\\+|\/+/g);
        this.name = nameParts[nameParts.length -1];
        this.size = size;
        this.type = type;
    }

    setFileTree(fileTree){
        this.fileTree = fileTree;
    }

}

class HCSFile {
    constructor(machinePath,path,size,type,lastModified){
        this.class = "HCSFile";
        this.classIndex = 2;
        this.machinePath = machinePath;
        this.path = path;
        let nameParts = path.split(/\\+|\/+/g);
        this.name = nameParts[nameParts.length -1];
        this.size = size;
        this.type = type;
        this.lastModified = lastModified;
    }

    setBuffer(buffer){
        this.buffer = buffer;
    }
}

class HCSSymLink {
    constructor(machinePath,path){
        this.class = "HCSSymLink";
        this.classIndex = 3;
        this.machinePath = machinePath;
        this.path = path;
        let nameParts = path.split(/\\+|\/+/g);
        this.name = nameParts[nameParts.length -1];
    }
}

module.exports.HCSFile = HCSFile;
module.exports.HCSDirectory = HCSDirectory;
module.exports.HCSSymLink = HCSSymLink;
module.exports.FileTree = FileTree;