class MultiClientComunication {

    constructor(hcs,intf) {

        this.interface = intf;
        this.webSocket = hcs.webSocket;
        this.webSocket.on("upload",this.parseComunication.bind(this));
        this.webSocket.on("move",this.parseComunication.bind(this));
        this.webSocket.on("delete",this.parseComunication.bind(this));
        this.webSocket.on("linksharefile",this.parseComunication.bind(this));
        this.webSocket.on("publicsharefile",this.parseComunication.bind(this));
        this.webSocket.on("createfolder",this.parseComunication.bind(this));
        this.webSocket.on("copy",this.parseComunication.bind(this));
    }

    parseComunication(data){
        switch(data.req){
            case "upload":
                if(samePath(this.interface.hcs.currentFolder, data.data)){
                    this.interface.openFolder(undefined,false,false);
                }
                break;
            case "move":
                if(samePath(this.interface.hcs.currentFolder, data.data[0]) || samePath(this.interface.hcs.currentFolder, data.data[1])){
                    this.interface.openFolder(undefined,false,false);
                }
                break;
            case "delete":
                var parentPath = data.data.substring(0,data.data.lastIndexOf("/"));
                var filename = data.data.substring(data.data.lastIndexOf("/")+1);
                if(samePath(this.interface.hcs.currentFolder,parentPath)){
                    let tr = this.interface.fileTableBody.querySelector(`tr[data-hcsname="${filename}"]`);
                    tr ? tr.remove() : undefined;
                }
                break;
            case "linksharefile":
            case "publicsharefile":
            case "createfolder":
            case "copy":
                var parentPath = data.data.substring(0,data.data.lastIndexOf("/"));
                if(samePath(this.interface.hcs.currentFolder,parentPath)){
                    this.interface.openFolder(undefined,false,false);
                }
                break;
            default:
                console.log(data);
        }

    }



}

function samePath(p1,p2){
    if(p1.endsWith("/")){
        p1 = p1.substring(0,p1.length-1);
    }
    if(p2.endsWith("/")){
        p2 = p2.substring(0,p2.length-1);
    }
    return p1 == p2;
}