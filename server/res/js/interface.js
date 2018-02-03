
class Interface {
    constructor(hcs) {
        this.hcs = hcs;

        //Compile root folder list in the drawer
        this.drawer = document.getElementById("overallLayout");
        this.drawerRootFolderList = document.getElementById("drawerRootFolders");
        for (let rf of this.hcs.rootFolderList.list) {
            let a = document.createElement("a");
            a.classList.add("mdl-navigation__link");
            if (rf == this.hcs.rootFolderList.selected) {
                a.classList.add("navigation__link--selected");
            }
            a.setAttribute("value", rf);
            a.innerText = rf;
            a.onclick = function(event){
                //Open the selected rootfolder and activate the corresponding drawer button
                this.hcs.rootFolderList.selected = rf;
                this.openFolder(rf+"/",true);
                for(let child of this.drawerRootFolderList.childNodes){
                    if(child.classList) child.classList.remove("navigation__link--selected");
                }
                a.classList.add("navigation__link--selected");
                //Close the drawer after click
                this.toggleDrawer(this.drawer);

            }.bind(this);
            //Upgrading the element for MDL rendering
            window.componentHandler.upgradeElement(a);
            this.drawerRootFolderList.appendChild(a);
        }
        this.drawerRootFolderList.lastChild.classList.add("mdl-menu__item--full-bleed-divider");
        

        //The loading placeholder entry of the file table
        this.cachedWaitingTableRow;

        //The snackbar reference, used as notification
        this.notification = document.querySelector('#snackbar');


        //The upper right menu, sorting buttons
        this.orderByTypeBtn = document.getElementById("orderByTypeBtn");
        this.orderByNameBtn = document.getElementById("orderByNameBtn");
        this.orderByTypeBtn.onclick = function(){this.buildFileTree(undefined,this.fileTree,false)}.bind(this);
        this.orderByNameBtn.onclick = function(){this.buildFileTreeByName(undefined,this.fileTree,false)}.bind(this);



        //Creating the wait table row
        this.cachedWaitingTableRow = this.createWaitingTableRow();
        //Creating the NotFound table row
        this.cachedNotFoundTableRow = this.createNotFoundTableRow();
        //Creating the error table row
        this.cachedErrorTableRow = this.createErrorTableRow();

        this.fileTableBody = document.getElementById("fileTableBody");
        this.pathArrowContainer = document.getElementById("pathArrowContainer");



        //Setting up the info dialog
        this.infoDialog = document.getElementById("fileInfoDialog");
        //Code required by the dialog polyfill to work
        if (!this.infoDialog.showModal) {
            dialogPolyfill.registerDialog(this.infoDialog);
        }
        //Setting the close button once
        this.infoDialog.closeBtn = document.querySelector("#fileInfoDialog .close");
        this.infoDialog.closeBtn.onclick = function () {
            document.title = "HCS";
            this.close();
        }.bind(this.infoDialog);
        //Retrieving all dialog fields
        this.infoDialog.titleLable = document.querySelector("#fileInfoDialog #dialogTitle");
        this.infoDialog.pathLable = document.querySelector("#fileInfoDialog #dialogPath");
        this.infoDialog.typeLable = document.querySelector("#fileInfoDialog #dialogType");
        this.infoDialog.sizeLable = document.querySelector("#fileInfoDialog #dialogSize");
        this.infoDialog.lastModifiedLable = document.querySelector("#fileInfoDialog #dialogLastModified");
        //Retrieving all dialog buttons
        this.infoDialog.downloadBtn = document.querySelector("#fileInfoDialog #dialogDownloadFile");
        this.infoDialog.deleteBtn = document.querySelector("#fileInfoDialog #dialogDeleteFile");
        this.infoDialog.publicShareBtn = document.querySelector("#fileInfoDialog #dialogPublicShareFile");
        this.infoDialog.linkShareBtn = document.querySelector("#fileInfoDialog #dialogLinkShareFile");


        //Setting up the dialog to choose the folder/file name
        this.chooseNameDialog = document.getElementById("chooseNameDialog");
        //Code required by the dialog polyfill to work
        if (!this.chooseNameDialog.showModal) {
            dialogPolyfill.registerDialog(this.chooseNameDialog);
        }
        //Setting the close button once
        this.chooseNameDialog.closeBtn = document.querySelector("#chooseNameDialog .close");
        this.chooseNameDialog.closeBtn.onclick = function () {
            this.close();
        }.bind(this.chooseNameDialog);
        this.chooseNameDialog.newNameInputBar = document.querySelector("#chooseNameDialog #newNameInputDialog");
        //Retrieving all dialog buttons
        this.chooseNameDialog.selectBtn = document.querySelector("#chooseNameDialog #dialogSelectNewName");

        //Setting up the input bar to change path
        this.changePathForm = document.getElementById("changePathForm");
        this.changePathBar = document.getElementById("changePathBar");
        this.changePathForm.onsubmit = function(event){
            event.preventDefault();
            this.openFolder(this.changePathBar.value);
            this.changePathForm.children[0].classList.remove("is-dirty");
        }.bind(this);

        //Setting up upload button
        this.addFileBtn = document.getElementById("addFileButton");
        this.bottomProgressBar = document.getElementById("bottomProgressBar");
        this.addFileBtn.onclick = function () {
            //Open the file picker
            let filePicker = document.getElementById("filePicker");
            //Upload the file once the filepicker has some files selected
            filePicker.onchange = function () {
                this.uploadFile(filePicker.files);
            }.bind(this);
            filePicker.click();
        }.bind(this);

        //Setting up the drag and drop system
        document.body.ondragover = function(event){
            //Prevent default browser behavior
            event.preventDefault();
        }
        document.body.ondragend = function (ev) {
            var dt = ev.dataTransfer;
            if (dt.items) {
                // Use DataTransferItemList interface to remove the drag data
                for (var i = 0; i < dt.items.length; i++) {
                    dt.items.remove(i);
                }
            } else {
                // Use DataTransfer interface to remove the drag data
                ev.dataTransfer.clearData();
            }
        }
        document.body.ondrop = function (ev) {
            ev.preventDefault();
            if(this.addFileBtn.disabled){
                return;
            }
            var files = [];
            // If dropped items aren't files, reject them
            var dt = ev.dataTransfer;
            if (dt.items) {
                // Use DataTransferItemList interface to access the file(s)
                for (var i = 0; i < dt.items.length; i++) {
                    if (dt.items[i].kind == "file") {
                        files.push(dt.items[i].getAsFile());
                    }
                }
            } else {
                // Use DataTransfer interface to access the file(s)
                for (var i = 0; i < dt.files.length; i++) {
                    files.push(dt.files[i]);
                }
            }
            if(files.length != 0){
                this.uploadFile(files);
            }
        }.bind(this);


        //Setting up the create new folder button
        this.addFolderBtn = document.getElementById("addFolderButton");
        this.addFolderBtn.onclick = this.addFolder.bind(this);

        //Setting up the drawer's button to open the recycle bin
        this.recycleBinBtn = document.getElementById("recycleBinBtn");
        this.recycleBinBtn.onclick = function(event){
            //Close the drawer after click
            this.toggleDrawer(this.drawer);
            //Open the folder
            this.openTrashFolder();
        }.bind(this);

        //Setting up the drawer's button to open the public share folder
        this.publicShareFolderBtn = document.getElementById("drawerPublicShareBtn");
        this.publicShareFolderBtn.onclick = function(event){
            //Close the drawer after click
            this.toggleDrawer(this.drawer);
            //Open the folder
            this.openPublicShareFolder();
        }.bind(this);

        //Setting up the drawer's button to open the link share folder
        this.publicLinkFolderBtn = document.getElementById("drawerLinkShareBtn");
        this.publicLinkFolderBtn.onclick = function(event){
            //Close the drawer after click
            this.toggleDrawer(this.drawer);
            //Open the folder
            this.openLinkShareFolder();
        }.bind(this);
        


        //Seting up the popstate event so that it handles back button clicks
        window.onpopstate = this.handleBackButton.bind(this);

        this.buildFileTree = this.buildFileTree.bind(this);
        this.openFolder = this.openFolder.bind(this);
        this.openTrashFolder = this.openTrashFolder.bind(this);
        this.openPublicShareFolder = this.openPublicShareFolder.bind(this);
        this.openLinkShareFolder = this.openLinkShareFolder.bind(this);
        this.uploadFile = this.uploadFile.bind(this);
        this.addFolder = this.addFolder.bind(this);
        this.openFile = this.openFile.bind(this);
    }


    /**
     * Handle the back button pressed when triggers a popevent
     * @param {DOMEvent} event - The event with the state in it 
     */
    handleBackButton(event){
        var state = event.state
        if(!state){
            //Navigated to the first page that doesn't have any state.
            //Simply ignore this event
            return;
        }
        if(state.type == "general"){
            this.openFolder(state.path,false);
        }
        else if(state.type == "trash"){
            this.openTrashFolder(state.path,false);
        }
        else if(state.type == "publicshare"){
            this.openPublicShareFolder(state.path,false);
        }
        else if(state.type == "linkshare"){
            this.openLinkShareFolder(state.path,false);
        }
    }


    openFolder(path,updateHistory = true, replacePreviousHistoryState = false) {
        
        //Clear the table and show a loading indication
        while (this.fileTableBody.firstChild) {
            this.fileTableBody.removeChild(this.fileTableBody.firstChild);
        }
        //Upgrading the element for MDL rendering
        window.componentHandler.upgradeElements(this.cachedWaitingTableRow);
        this.fileTableBody.appendChild(this.cachedWaitingTableRow);

        if (!path) {
            //If path is undefined use the current synced directly
            path = this.hcs.currentFolder;

            //Check if the folder is a special folder
            if(path.includes("$hcs$trash")){
                this.openTrashFolder(path, true, false);
                return;
            }
            else if(path.includes("$hcs$publicshare")){
                this.openPublicShareFolder(path, true, false);
                return;
            }
            else if(path.includes("$hcs$linkshare")){
                this.openLinkShareFolder(path, true, false);
                return;
            }

            //Else, open this folder normaly
            this.hcs.requestFileTree(path, 1, this.buildFileTree);

            //Enable file upload button and add folder button if not uploading
            if(!this.isUploadingFile){
                this.addFileBtn.disabled = false;
            }
            this.addFolderBtn.disabled = false;
            this.inSpecialFolder = false; //Used to tell to other components that we are in a special folder

            //Update the history state if requested and also if the last state is not the same as the one we are trying to update
            if (updateHistory && !(history.state && history.state.path == path)) {
                let state = {
                    path: path,
                    type: "general"
                };
                if (history.state && history.state.path == state.path) {
                    return;
                }

                if (replacePreviousHistoryState) {
                    window.history.replaceState(state, "HCS", "/");
                }
                else {
                    window.history.pushState(state, "HCS", "/");
                }
                console.log("Updating history with " + state.path);
            }
        }
        else {
            //Change path and then load the file tree
            this.hcs.changeCurrentFolder(path, function (err, newPath) {
                if (!err) {
                    //Check if the folder is a special folder
                    if (newPath.includes("$hcs$trash")) {
                        this.openTrashFolder(path, true, false);
                        return;
                    }
                    else if (newPath.includes("$hcs$publicshare")) {
                        this.openPublicShareFolder(path, true, false);
                        return;
                    }
                    else if (newPath.includes("$hcs$linkshare")) {
                        this.openLinkShareFolder(path, true, false);
                        return;
                    }

                    //Else, open this folder normaly
                    this.hcs.requestFileTree(newPath, 1, this.buildFileTree);

                    //Enable file upload button and add folder button if not uploading
                    if(!this.isUploadingFile){
                        this.addFileBtn.disabled = false;
                    }
                    this.addFolderBtn.disabled = false;
                    this.inSpecialFolder = false; //Used to tell to other components that we are in a special folder

                    //Update the history state if requested and also if the last state is not the same as the one we are trying to update
                    if (updateHistory && !(history.state && history.state.path == newPath)) {
                        let state = {
                            path: newPath,
                            type: "general"
                        };
                        if (history.state && history.state.path == state.path) {
                            return;
                        }

                        if (replacePreviousHistoryState) {
                            window.history.replaceState(state, "HCS", "/");
                        }
                        else {
                            window.history.pushState(state, "HCS", "/");
                        }
                        console.log("Updating history with " + state.path);
                    }
                }
                else if (err == 404) {
                    
                    var data = {
                        message: path + " Not Found",
                        actionHandler: function (event) { this.openFolder(path,false) }.bind(this),
                        actionText: 'Retry',
                        timeout: 3000
                     };
                    this.notification.MaterialSnackbar.showSnackbar(data);

                    //Clear the table and show a NotFound indication
                    while (this.fileTableBody.firstChild) {
                        this.fileTableBody.removeChild(this.fileTableBody.firstChild);
                    }
                    //Upgrading the element for MDL rendering
                    window.componentHandler.upgradeElements(this.cachedNotFoundTableRow);
                    this.fileTableBody.appendChild(this.cachedNotFoundTableRow);
                }
                else {
                    
                    var data = {
                        message: "Error: " + err,
                        actionHandler: function (event) { this.openFolder(path,false) }.bind(this),
                        actionText: 'Retry',
                        timeout: 3000
                    };
                    this.notification.MaterialSnackbar.showSnackbar(data);
                    
                    //Clear the table and show an error indication
                    while (this.fileTableBody.firstChild) {
                        this.fileTableBody.removeChild(this.fileTableBody.firstChild);
                    }
                    //Upgrading the element for MDL rendering
                    window.componentHandler.upgradeElements(this.cachedErrorTableRow);
                    this.fileTableBody.appendChild(this.cachedErrorTableRow);
                }
            }.bind(this));
        }
    }


    openTrashFolder(path, updateHistory = true, replacePreviousHistoryState = false) {
        //Clear the table and show a loading indication
        while (this.fileTableBody.firstChild) {
            this.fileTableBody.removeChild(this.fileTableBody.firstChild);
        }
        this.fileTableBody.appendChild(this.cachedWaitingTableRow);

        if (!path) {
            //If path is undefined use the current synced directly
            path = this.hcs.currentFolder;
        }
        this.hcs.requestTrashFolder(path, function (err, tFolder) {
            //Error handling
            if (err) {
                var data = {
                    message: "Error opening the recycle bin",
                    actionHandler: function (event) { this.openTrashFolder(path, false) }.bind(this),
                    actionText: 'Retry',
                    timeout: 3000
                };
                this.notification.MaterialSnackbar.showSnackbar(data);                    
                //Clear the table and show an error indication
                while (this.fileTableBody.firstChild) {
                    this.fileTableBody.removeChild(this.fileTableBody.firstChild);
                }
                //Upgrading the element for MDL rendering
                window.componentHandler.upgradeElements(this.cachedErrorTableRow);
                this.fileTableBody.appendChild(this.cachedErrorTableRow);

                return;
            }
            //Disable file upload button and add folder button
            this.addFileBtn.disabled = true;
            this.addFolderBtn.disabled = true;
            this.inSpecialFolder = true; //Used to tell to other components that we are in a special folder
            //Change path and then load the file tree
            path = tFolder.insideFolderPath;
            this.hcs.changeCurrentFolder(path, function (err, newPath) {
                if (!err) {
                    this.hcs.requestFileTree(newPath, 1, function (err, fileTree) {
                        this.buildFileTree(err, fileTree, true, true, true, undefined, { $hcs$trash: "Recycle Bin" }, { canShare: false });
                    }.bind(this));

                    //Update the history state if requested and also if the last state is not the same as the one we are trying to update
                    if (updateHistory && !(history.state && history.state.path == newPath)) {
                        let state = {
                            path: newPath,
                            type: "trash"
                        };
                        if (history.state && history.state.path == state.path) {
                            return;
                        }

                        if (replacePreviousHistoryState) {
                            window.history.replaceState(state, "HCS", "/");
                        }
                        else {
                            window.history.pushState(state, "HCS", "/");
                        }
                        console.log("Updating history with " + state.path);
                    }
                }
                else {
                    //Must be a server internal error because it's sure that there is a trash folder
                    var data = {
                        message: "Error: " + err,
                        actionHandler: function (event) { this.openTrashFolder(path, false) }.bind(this),
                        actionText: 'Retry',
                        timeout: 3000
                    };
                    this.notification.MaterialSnackbar.showSnackbar(data);
                }
            }.bind(this));
        }.bind(this));
    }

    openPublicShareFolder(path, updateHistory = true, replacePreviousHistoryState = false) {
        //Clear the table and show a loading indication
        while (this.fileTableBody.firstChild) {
            this.fileTableBody.removeChild(this.fileTableBody.firstChild);
        }
        this.fileTableBody.appendChild(this.cachedWaitingTableRow);

        if (!path) {
            //If path is undefined use the current synced directly
            path = this.hcs.currentFolder;
        }
        this.hcs.requestPublicShareFolder(path, function (err, pFolder) {
            //Error handling
            if (err) {
                var data = {
                    message: "Error opening the public share folder",
                    actionHandler: function (event) { this.openPublicShareFolder(path, false) }.bind(this),
                    actionText: 'Retry',
                    timeout: 3000
                };
                this.notification.MaterialSnackbar.showSnackbar(data);                    
                //Clear the table and show an error indication
                while (this.fileTableBody.firstChild) {
                    this.fileTableBody.removeChild(this.fileTableBody.firstChild);
                }
                //Upgrading the element for MDL rendering
                window.componentHandler.upgradeElements(this.cachedErrorTableRow);
                this.fileTableBody.appendChild(this.cachedErrorTableRow);

                return;
            }
            //Disable file upload button and add folder button
            this.addFileBtn.disabled = true;
            this.addFolderBtn.disabled = true;
            this.inSpecialFolder = true; //Used to tell to other components that we are in a special folder
            //Change path and then load the file tree
            path = pFolder.insideFolderPath;
            this.hcs.changeCurrentFolder(path, function (err, newPath) {
                if (!err) {
                    this.hcs.requestFileTree(newPath, 1, function(err,fileTree){
                        this.buildFileTree(err,fileTree,true,true,true,undefined,{$hcs$publicshare: "Public Share"},{canShare: false});
                    }.bind(this));
                    
                    //Update the history state if requested and also if the last state is not the same as the one we are trying to update
                    if (updateHistory && !(history.state && history.state.path == newPath)) {
                        let state = {
                            path: newPath,
                            type: "publicshare"
                        };
                        if (history.state && history.state.path == state.path) {
                            return;
                        }

                        if (replacePreviousHistoryState) {
                            window.history.replaceState(state, "HCS", "/");
                        }
                        else {
                            window.history.pushState(state, "HCS", "/");
                        }
                        console.log("Updating history with " + state.path);
                    }
                }
                else {
                    //Must be a server internal error because it's sure that there is a public share folder
                    var data = {
                        message: "Error: " + err,
                        actionHandler: function (event) { this.openPublicShareFolder(path, false) }.bind(this),
                        actionText: 'Retry',
                        timeout: 3000
                    };
                    this.notification.MaterialSnackbar.showSnackbar(data);
                }
            }.bind(this));
        }.bind(this));
    }

    openLinkShareFolder(path, updateHistory = true, replacePreviousHistoryState = false) {
        //Clear the table and show a loading indication
        while (this.fileTableBody.firstChild) {
            this.fileTableBody.removeChild(this.fileTableBody.firstChild);
        }
        this.fileTableBody.appendChild(this.cachedWaitingTableRow);

        if (!path) {
            //If path is undefined use the current synced directly
            path = this.hcs.currentFolder;
        }
        this.hcs.requestLinkShareFolder(path, function (err, pFolder) {
            //Error handling
            if (err) {
                var data = {
                    message: "Error opening the link share folder",
                    actionHandler: function (event) { this.openLinkShareFolder(path, false) }.bind(this),
                    actionText: 'Retry',
                    timeout: 3000
                };
                this.notification.MaterialSnackbar.showSnackbar(data);                    
                //Clear the table and show an error indication
                while (this.fileTableBody.firstChild) {
                    this.fileTableBody.removeChild(this.fileTableBody.firstChild);
                }
                //Upgrading the element for MDL rendering
                window.componentHandler.upgradeElements(this.cachedErrorTableRow);
                this.fileTableBody.appendChild(this.cachedErrorTableRow);

                return;
            }
            //Disable file upload button and add folder button
            this.addFileBtn.disabled = true;
            this.addFolderBtn.disabled = true;
            this.inSpecialFolder = true; //Used to tell to other components that we are in a special folder
            //Change path and then load the file tree
            path = pFolder.insideFolderPath;
            this.hcs.changeCurrentFolder(path, function (err, newPath) {
                if (!err) {
                    this.hcs.requestFileTree(newPath, 1, function(err,fileTree){
                        this.buildFileTree(err,fileTree,true,true,true,undefined,{$hcs$linkshare: "Link Share"},{canShare: false});
                    }.bind(this));
                    
                    //Update the history state if requested and also if the last state is not the same as the one we are trying to update
                    if (updateHistory && !(history.state && history.state.path == newPath)) {
                        let state = {
                            path: newPath,
                            type: "linkshare"
                        };
                        if (history.state && history.state.path == state.path) {
                            return;
                        }

                        if (replacePreviousHistoryState) {
                            window.history.replaceState(state, "HCS", "/");
                        }
                        else {
                            window.history.pushState(state, "HCS", "/");
                        }
                        console.log("Updating history with " + state.path);
                    }
                }
                else {
                    //Must be a server internal error because it's sure that there is a public share folder
                    var data = {
                        message: "Error: " + err,
                        actionHandler: function (event) { this.openPublicShareFolder(path, false) }.bind(this),
                        actionText: 'Retry',
                        timeout: 3000
                    };
                    this.notification.MaterialSnackbar.showSnackbar(data);
                }
            }.bind(this));
        }.bind(this));
    }



    /**
     * Builds the arrow path on top of the file table
     * @param {String} arrowPath - A path shown with one arrow for each folcer
     * @param {Object} arrowPathReplacements - A dictionary with a value replacement for some folder names in the arrow path
     */
     buildArrowPath(arrowPath, arrowPathReplacements = {}){
        //System folder names always to be replaced
        arrowPathReplacements.$hcs$trash = "Recyle Bin";
        arrowPathReplacements.$hcs$linkshare = "Link Share";
        arrowPathReplacements.$hcs$publicshare = "Public Share";
        //Clear the arrow path container
        while (this.pathArrowContainer.firstChild) {
            this.pathArrowContainer.removeChild(this.pathArrowContainer.firstChild);
        }
        //Create path arrows
        let currentPathParts = arrowPath.split("/");
        for (let pIndex in currentPathParts) {
            let pathPart = currentPathParts[pIndex];
            //Replace the folders if requested to be replaced
            arrowPathReplacements[pathPart] ? pathPart = arrowPathReplacements[pathPart] : undefined;
            //split() create a last empty element if path ends with "/", so ignore it
            if (pathPart.trim() == "") continue;

            //Recreate the full path for this arrow 
            let pathUntileThis = "";
            for (let i = 0; i <= pIndex; i++) {
                pathUntileThis += currentPathParts[i] + "/";
            }

            //Create the DOM element for the path part
            let arrow = document.createElement("div");
            arrow.classList.add("path-element-arrow");
            let span = document.createElement("span");
            span.innerText = pathPart;
            arrow.onclick = function () {
                this.openFolder(pathUntileThis);
            }.bind(this);
            arrow.appendChild(span);
            this.pathArrowContainer.appendChild(arrow);
        }

        //Finally setting up the path string into the changePathBar
        this.changePathBar.value = arrowPath;
     }



    /**
     * Build the table for the file tree
     * @param {String} err - The error returned by the server
     * @param {FileTree} fileTree - The FileTree returned by the server
     * @param {boolean} [updateFTState = true] - True if this.fileTree should be updated
     * @param {boolean} [printFolders = true] - True if folders should be shown
     * @param {boolean} [printFiles = true]  - True if files should be shown
     * @param {String} [customArrowPath] - A custom path shown with one arrow for each folcer
     * @param {Object} [arrowPathReplacements] - A dictionary with a value replacement for some folder names in the arrow path
     * @param {Object} [options] - An option container
     * @param {Boolean} [options.canShare = true] - Sets the share buttons in the info dialog enabled or disabled 
     */
    buildFileTree(err, fileTree, updateFTState = true, printFolders = true, printFiles = true, customArrowPath, arrowPathReplacements = {}, options = {}) {
        if(updateFTState) this.fileTree = fileTree;
        //Remove all child nodes present at this moment
        while (this.fileTableBody.firstChild) {
            this.fileTableBody.removeChild(this.fileTableBody.firstChild);
        }

        if (err) {
            this.fileTableBody.innerHTML = err;
            return;
        }

        //Create path arrows
        this.buildArrowPath(customArrowPath || fileTree.path, arrowPathReplacements);

        //Create all the directories' table row
        if (printFolders) {
            for (let dir of fileTree.dirList) {
                let tr = document.createElement("tr");
                tr.setAttribute("data-hcsname", dir.name);
                tr.classList.add("pointable");
                let tdName = document.createElement("td");
                tdName.classList.add("mdl-data-table__cell--non-numeric");
                let tdSize = document.createElement("td");
                let tdInfo = document.createElement("td");
                tdInfo.classList.add("mdl-data-table__cell--non-numeric");

                //Name and icon, first table data
                let leftIconDiv = document.createElement("div");
                leftIconDiv.classList.add("icon-cell_left");
                let icon = document.createElement("i");
                icon.classList.add("material-icons");
                icon.innerHTML = "folder";
                let span = document.createElement("span");
                span.innerHTML = dir.name;
                leftIconDiv.appendChild(icon);
                leftIconDiv.appendChild(span);
                tdName.appendChild(leftIconDiv);

                //Size
                tdSize.innerHTML = "";

                //Info icon button
                let rightIconDiv = document.createElement("div");
                rightIconDiv.classList.add("icon-cell_right");
                let iconInfo = document.createElement("i");
                iconInfo.classList.add("material-icons");
                iconInfo.innerHTML = "info";
                rightIconDiv.appendChild(iconInfo);
                tdInfo.appendChild(rightIconDiv);
                tdInfo.onclick = function (event) {
                    event.stopPropagation();
                    this.showFileInfo(dir,tr,options.canShare);
                }.bind(this);

                tr.appendChild(tdName);
                tr.appendChild(tdSize);
                tr.appendChild(tdInfo);
                tr.onclick = function () {
                    this.openFolder(dir.path);
                }.bind(this);
                this.fileTableBody.appendChild(tr);
            }
        }

        //Create all files' table row
        if (printFiles) {
            for (let file of fileTree.fileList) {
                let tr = document.createElement("tr");
                tr.setAttribute("data-hcsname", file.name);
                tr.classList.add("pointable");
                let tdName = document.createElement("td");
                tdName.classList.add("mdl-data-table__cell--non-numeric");
                let tdSize = document.createElement("td");
                let tdInfo = document.createElement("td");
                tdInfo.classList.add("mdl-data-table__cell--non-numeric");

                //Name and icon, first table data
                let leftIconDiv = document.createElement("div");
                leftIconDiv.classList.add("icon-cell_left");
                let icon = document.createElement("i");
                icon.classList.add("material-icons");
                icon.innerHTML = "insert_drive_file";
                let span = document.createElement("span");
                span.innerHTML = file.name;
                leftIconDiv.appendChild(icon);
                leftIconDiv.appendChild(span);
                tdName.appendChild(leftIconDiv);

                //Size
                let fileSize;
                if (file.size >= 1000 * 1000) {
                    fileSize = (file.size / (1000 * 1000));
                    fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                    fileSize += " MB";
                }
                else if (file.size >= 1000) {
                    fileSize = (file.size / (1000));
                    fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                    fileSize += " kB";
                }
                else {
                    fileSize = file.size;
                    fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                    fileSize += " B";
                }
                tdSize.innerHTML = fileSize;

                //Info icon button
                let rightIconDiv = document.createElement("div");
                rightIconDiv.classList.add("icon-cell_right");
                let iconInfo = document.createElement("i");
                iconInfo.classList.add("material-icons");
                iconInfo.innerHTML = "info";
                rightIconDiv.appendChild(iconInfo);
                tdInfo.appendChild(rightIconDiv);
                tdInfo.onclick = function (event) {
                    event.stopPropagation();
                    this.showFileInfo(file, tr,options.canShare);
                }.bind(this);

                tr.appendChild(tdName);
                tr.appendChild(tdSize);
                tr.appendChild(tdInfo);
                tr.onclick = function () {
                    this.openFile(file.path);
                }.bind(this);
                this.fileTableBody.appendChild(tr);
            }
        }
    }


    /**
     * Build the table for the file tree sorting entris by name
     * @param {String} err - The error returned by the server
     * @param {FileTree} fileTree - The FileTree returned by the server
     * @param {boolean} updateFTState - True if this.fileTree should be updated
     * @param {boolean} printFolders - True if folders should be shown
     * @param {boolean} printFiles - True if files should be shown
     * @param {String} customArrowPath - A custom path shown with one arrow for each folcer
     * @param {Object} arrowPathReplacements - A dictionary with a value replacement for some folder names in the arrow path
     * @param {Object} [options] - An option container
     * @param {Boolean} [options.canShare = true] - Sets the share buttons in the info dialog enabled or disabled
     */
    buildFileTreeByName(err, fileTree, updateFTState = true, printFolders = true, printFiles = true, customArrowPath, arrowPathReplacements = {}, options = {}) {
        if(updateFTState) this.fileTree = fileTree;
        //Remove all child nodes present at this moment
        while (this.fileTableBody.firstChild) {
            this.fileTableBody.removeChild(this.fileTableBody.firstChild);
        }

        if (err) {
            this.fileTableBody.innerHTML = err;
            return;
        }

        //Create path arrows
        this.buildArrowPath(customArrowPath || fileTree.path, arrowPathReplacements);

        //An array where all the table rows are stored and then sorted
        var toSort = [];

        //Create all the directories' table row
        if (printFolders) {
            for (let dir of fileTree.dirList) {
                let tr = document.createElement("tr");
                tr.setAttribute("data-hcsname", dir.name);
                tr.classList.add("pointable");
                let tdName = document.createElement("td");
                tdName.classList.add("mdl-data-table__cell--non-numeric");
                let tdSize = document.createElement("td");
                let tdInfo = document.createElement("td");
                tdInfo.classList.add("mdl-data-table__cell--non-numeric");

                //Name and icon, first table data
                let leftIconDiv = document.createElement("div");
                leftIconDiv.classList.add("icon-cell_left");
                let icon = document.createElement("i");
                icon.classList.add("material-icons");
                icon.innerHTML = "folder";
                let span = document.createElement("span");
                span.innerHTML = dir.name;
                leftIconDiv.appendChild(icon);
                leftIconDiv.appendChild(span);
                tdName.appendChild(leftIconDiv);

                //Size
                tdSize.innerHTML = "";

                //Info icon button
                let rightIconDiv = document.createElement("div");
                rightIconDiv.classList.add("icon-cell_right");
                let iconInfo = document.createElement("i");
                iconInfo.classList.add("material-icons");
                iconInfo.innerHTML = "info";
                rightIconDiv.appendChild(iconInfo);
                tdInfo.appendChild(rightIconDiv);
                tdInfo.onclick = function (event) {
                    event.stopPropagation();
                    this.showFileInfo(dir,tr,options.canShare);
                }.bind(this);

                tr.appendChild(tdName);
                tr.appendChild(tdSize);
                tr.appendChild(tdInfo);
                tr.onclick = function () {
                    this.openFolder(dir.path);
                }.bind(this);
                toSort.push(tr);
            }
        }

        //Create all files' table row
        if (printFiles) {
            for (let file of fileTree.fileList) {
                let tr = document.createElement("tr");
                tr.setAttribute("data-hcsname", file.name);
                tr.classList.add("pointable");
                let tdName = document.createElement("td");
                tdName.classList.add("mdl-data-table__cell--non-numeric");
                let tdSize = document.createElement("td");
                let tdInfo = document.createElement("td");
                tdInfo.classList.add("mdl-data-table__cell--non-numeric");

                //Name and icon, first table data
                let leftIconDiv = document.createElement("div");
                leftIconDiv.classList.add("icon-cell_left");
                let icon = document.createElement("i");
                icon.classList.add("material-icons");
                icon.innerHTML = "insert_drive_file";
                let span = document.createElement("span");
                span.innerHTML = file.name;
                leftIconDiv.appendChild(icon);
                leftIconDiv.appendChild(span);
                tdName.appendChild(leftIconDiv);

                //Size
                let fileSize;
                if (file.size >= 1000 * 1000) {
                    fileSize = (file.size / (1000 * 1000));
                    fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                    fileSize += " MB";
                }
                else if (file.size >= 1000) {
                    fileSize = (file.size / (1000));
                    fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                    fileSize += " kB";
                }
                else {
                    fileSize = file.size;
                    fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                    fileSize += " B";
                }
                tdSize.innerHTML = fileSize;

                //Info icon button
                let rightIconDiv = document.createElement("div");
                rightIconDiv.classList.add("icon-cell_right");
                let iconInfo = document.createElement("i");
                iconInfo.classList.add("material-icons");
                iconInfo.innerHTML = "info";
                rightIconDiv.appendChild(iconInfo);
                tdInfo.appendChild(rightIconDiv);
                tdInfo.onclick = function (event) {
                    event.stopPropagation();
                    this.showFileInfo(file, tr,options.canShare);
                }.bind(this);

                tr.appendChild(tdName);
                tr.appendChild(tdSize);
                tr.appendChild(tdInfo);
                tr.onclick = function () {
                    this.openFile(file.path);
                }.bind(this);
                toSort.push(tr);
            }
        }


        toSort.sort(function(tr1,tr2){
            if(tr1.getAttribute("data-hcsname").toLowerCase() < tr2.getAttribute("data-hcsname").toLowerCase()){
                return -1;
            }
            else if(tr1.getAttribute("data-hcsname").toLowerCase() > tr2.getAttribute("data-hcsname").toLowerCase()){
                return 1;
            }
            else{
                return 0;
            }
        });
        toSort.forEach(function(tr){
            this.fileTableBody.appendChild(tr);
        }.bind(this));
    }


    showFileInfo(file,tr,canShare = true) {
        document.title = file.name;
        let i = this.infoDialog;
        i.titleLable.innerText = file.name;
        i.pathLable.innerText = file.path;
        i.typeLable.innerText = file.type;
        //If its a file, just parse the size
        if (file.classIndex != 1) {
            let fileSize;
            if (file.size >= 1000 * 1000) {
                fileSize = (file.size / (1000 * 1000));
                fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                fileSize += " MB";
            }
            else if (file.size >= 1000) {
                fileSize = (file.size / (1000));
                fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                fileSize += " kB";
            }
            else {
                fileSize = file.size;
                fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                fileSize += " B";
            }
            i.sizeLable.innerText = fileSize;
        }
        else {
            i.sizeLable.innerText = "Click to calculate size...";
            i.sizeLable.style.cursor = "pointer";
            i.sizeLable.style.color = "blue";
            i.sizeLable.onclick = function () {
                i.sizeLable.innerText = "Loading...";
                this.hcs.requestFolderSize(file.path, function (err, size) {
                    i.sizeLable.style.cursor = "";
                    i.sizeLable.style.color = "";
                    if (err) {
                        i.sizeLable.innerText = err;
                    }
                    else {
                        let fileSize;
                        if (size >= 1000 * 1000) {
                            fileSize = (size / (1000 * 1000));
                            fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                            fileSize += " MB";
                        }
                        else if (size >= 1000) {
                            fileSize = (size / (1000));
                            fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                            fileSize += " kB";
                        }
                        else {
                            fileSize = size;
                            fileSize = Math.ceil(fileSize * 100) / 100; //To have 2 decimals
                            fileSize += " B";
                        }
                        i.sizeLable.innerText = fileSize;
                    }
                });
            }.bind(this);
        }
        i.lastModifiedLable.innerText = new Date(file.lastModified).toString();

        //Set up download button
        if(file.classIndex != 1){
            i.downloadBtn.onclick = function(){
                let a = document.createElement("a");
                a.setAttribute("href","/files?req=file&path=" + file.path);
                a.setAttribute("download",file.name);
                a.click();
            }
        }
        else{
            i.downloadBtn.setAttribute("disabled","true");
        }
        
        //Set up delete button
        i.deleteBtn.onclick = function(){
            let result = confirm(`Are you sure to delete ${file.name} ?`);
            if(result){
                this.hcs.requestDeleteFile(file.path,function(err){
                    if (err) {
                        
                        var data = {
                            message: `Error deleting ${file.name}: ${err} `,
                            actionHandler: function (event) { this.click() }.bind(i.deleteBtn),
                            actionText: 'Retry',
                            timeout: 3000
                        };
                        this.notification.MaterialSnackbar.showSnackbar(data);
                    }
                    else{
                        
                        var data = {
                            message: `${file.name} deleted`,
                            timeout: 3000
                        };
                        //Close the dialog and reload the current folder
                        document.title = "HCS";
                        this.infoDialog.close();
                        tr.remove();
                        this.notification.MaterialSnackbar.showSnackbar(data);
                        
                    }
                }.bind(this));
            }
        }.bind(this);

        if (canShare == true) {
            //Enable buttons if they have been disabled by previous calls
            i.publicShareBtn.removeAttribute("disabled");
            //If is not a folder (classIndex 1 == Folder)
            if(file.classIndex != 1){
                i.linkShareBtn.removeAttribute("disabled");
            }
            
            i.publicShareBtn.onclick = function () {
                this.hcs.shareFilePublic(file.path, function (err) {
                    if (err) {

                        var data = {
                            message: `Error sharing ${file.name}: ${err} `,
                            actionHandler: function (event) { this.click() }.bind(i.publicShareBtn),
                            actionText: 'Retry',
                            timeout: 3000
                        };
                        this.notification.MaterialSnackbar.showSnackbar(data);
                    }
                    else {

                        var data = {
                            message: `${file.name} shared`,
                            timeout: 3000
                        };
                        //Close the dialog
                        document.title = "HCS";
                        this.infoDialog.close();
                        this.notification.MaterialSnackbar.showSnackbar(data);

                    }
                }.bind(this));
            }.bind(this);

            i.linkShareBtn.onclick = function(){
                this.hcs.shareFileLink(file.path,function(err,link){
                    if (err) {

                        var data = {
                            message: `Error sharing ${file.name}: ${err} `,
                            actionHandler: function (event) { this.click() }.bind(i.linkShareBtn),
                            actionText: 'Retry',
                            timeout: 3000
                        };
                        this.notification.MaterialSnackbar.showSnackbar(data);
                    }
                    else {

                        var data = {
                            message: `${file.name} shared - Link: ${document.location.origin + link}`,
                            actionHandler: function(event) { this.notification.MaterialSnackbar.cleanup_()}.bind(this),
                            actionText: 'Close',
                            timeout: (1000*60)
                        };
                        //Close the dialog
                        document.title = "HCS";
                        this.infoDialog.close();
                        this.notification.MaterialSnackbar.showSnackbar(data);

                    }
                }.bind(this));
            }.bind(this);
        }
        else{
            i.publicShareBtn.setAttribute("disabled","true");
            i.linkShareBtn.setAttribute("disabled","true");
        }

        i.showModal();
    }

    uploadFile(files) {
        if(!files || files.length < 1){
            return;
        }
        //Show the progress bar and lock the add button first
        this.bottomProgressBar.style.display = "";
        this.addFileBtn.setAttribute("disabled", "true");
        this.isUploadingFile = true;
        //Grab a reference to the files name
        var filesName = files[0].name;
        filesName += (files.length > 1) ? ` + ${files.length - 1} more` : "";
        //And then start uploading the file
        console.log("Started uploding " + filesName);
        this.hcs.uploadFile("./", files,
            function (perc) {
                //Every time a new percentage of uploading is calculated, update the progressbar
                if (perc != 1) {
                    this.bottomProgressBar.MaterialProgress.setProgress(perc * 100);
                }
                else {
                    this.bottomProgressBar.classList.add("mdl-progress--indeterminate");
                }

            }.bind(this),
            function (err,filePath) {
                if (err) {
                    //Show the toast to notify upload error
                    var data = {
                        message: `Error uploading ${filesName}`,
                        timeout: 3000
                    };
                    this.notification.MaterialSnackbar.showSnackbar(data);
                }
                else {
                    //Show the toast to confirm upload
                    var data = {
                        message: `${filesName} uploaded`,
                        timeout: 3000
                    };
                    this.notification.MaterialSnackbar.showSnackbar(data);
                }
                //Hide the progress bar and remove the indeterminate state
                this.bottomProgressBar.style.display = "none";
                this.bottomProgressBar.classList.remove("mdl-progress--indeterminate");
                //Reload the folder
                this.openFolder(undefined, false);
                //Unlock the addFile button if not in a special folder
                if(!this.inSpecialFolder) this.addFileBtn.removeAttribute("disabled");
                this.isUploadingFile = false;

            }.bind(this)
        );
    }

    addFolder(){
        let i = this.chooseNameDialog;
        i.selectBtn.onclick = function(){
            if(i.newNameInputBar.value.trim() != ""){
                this.hcs.requestCreateFolder("./"+i.newNameInputBar.value,function(err){
                    if(err){
                        var data = {
                            message: `Cannot create folder ${i.newNameInputBar.value}: Invalid path`,
                            timeout: 3000
                        };
                        this.notification.MaterialSnackbar.showSnackbar(data);
                    }
                    else{
                        var data = {
                            message: `${i.newNameInputBar.value} created`,
                            timeout: 3000
                        };
                        this.notification.MaterialSnackbar.showSnackbar(data);
                        this.openFolder(undefined,false);
                    }
                    i.close();
                }.bind(this));
            }
        }.bind(this);

        i.showModal();
    }

    openFile(path) {
        path = encodeURIComponent(path);
        document.location = "/files?req=file&path=" + path;
    }

    toggleDrawer(drawer){
        if(drawer.classList.contains("is-small-screen")){
            drawer.MaterialLayout.toggleDrawer();
        }
    }

    createWaitingTableRow(){
        let tr = document.createElement("tr");
        tr.classList.add("pointable");
        let tdName = document.createElement("td");
        tdName.classList.add("mdl-data-table__cell--non-numeric");
        let tdSize = document.createElement("td");
        let tdInfo = document.createElement("td");
        tdInfo.classList.add("mdl-data-table__cell--non-numeric");

        //Name and icon, first table data
        let leftIconDiv = document.createElement("div");
        leftIconDiv.classList.add("icon-cell_left");
        //<div class="mdl-spinner mdl-js-spinner is-active"></div> is the MDL loading spinner
        let loadingSpinner = document.createElement("div");
        loadingSpinner.classList.add("mdl-spinner");
        loadingSpinner.classList.add("mdl-js-spinner");
        loadingSpinner.classList.add("is-active");
        let span = document.createElement("span");
        span.innerHTML = "Loading...";
        leftIconDiv.appendChild(loadingSpinner);
        leftIconDiv.appendChild(span);
        tdName.appendChild(leftIconDiv);

        //Size
        tdSize.innerHTML = "Loading...";

        //Info icon button
        let rightIconDiv = document.createElement("div");
        rightIconDiv.classList.add("icon-cell_right");
        let iconInfo = document.createElement("i");
        iconInfo.classList.add("material-icons");
        iconInfo.innerHTML = "watch_later";
        rightIconDiv.appendChild(iconInfo);
        tdInfo.appendChild(rightIconDiv);

        tr.appendChild(tdName);
        tr.appendChild(tdSize);
        tr.appendChild(tdInfo);

        return tr;
    }

    createNotFoundTableRow(){
        let tr = document.createElement("tr");
        tr.classList.add("pointable");
        let tdName = document.createElement("td");
        tdName.classList.add("mdl-data-table__cell--non-numeric");
        let tdSize = document.createElement("td");
        let tdInfo = document.createElement("td");
        tdInfo.classList.add("mdl-data-table__cell--non-numeric");

        //Name and icon, first table data
        let leftIconDiv = document.createElement("div");
        leftIconDiv.classList.add("icon-cell_left");
        //<div class="mdl-spinner mdl-js-spinner is-active"></div> is the MDL loading spinner
        let icon = document.createElement("i");
        icon.classList.add("material-icons");
        icon.innerHTML = "error_outline";
        let span = document.createElement("span");
        span.innerHTML = "Not Found !";
        leftIconDiv.appendChild(icon);
        leftIconDiv.appendChild(span);
        tdName.appendChild(leftIconDiv);

        //Size
        tdSize.innerHTML = "Not Found !";

        //Info icon button
        let rightIconDiv = document.createElement("div");
        rightIconDiv.classList.add("icon-cell_right");
        let iconInfo = document.createElement("i");
        iconInfo.classList.add("material-icons");
        iconInfo.innerHTML = "error_outline";
        rightIconDiv.appendChild(iconInfo);
        tdInfo.appendChild(rightIconDiv);

        tr.appendChild(tdName);
        tr.appendChild(tdSize);
        tr.appendChild(tdInfo);

        return tr;
    }

    createErrorTableRow(){
        let tr = document.createElement("tr");
        tr.classList.add("pointable");
        let tdName = document.createElement("td");
        tdName.classList.add("mdl-data-table__cell--non-numeric");
        let tdSize = document.createElement("td");
        let tdInfo = document.createElement("td");
        tdInfo.classList.add("mdl-data-table__cell--non-numeric");

        //Name and icon, first table data
        let leftIconDiv = document.createElement("div");
        leftIconDiv.classList.add("icon-cell_left");
        //<div class="mdl-spinner mdl-js-spinner is-active"></div> is the MDL loading spinner
        let icon = document.createElement("i");
        icon.classList.add("material-icons");
        icon.innerHTML = "warning";
        let span = document.createElement("span");
        span.innerHTML = "Error !";
        leftIconDiv.appendChild(icon);
        leftIconDiv.appendChild(span);
        tdName.appendChild(leftIconDiv);

        //Size
        tdSize.innerHTML = "Error !";

        //Info icon button
        let rightIconDiv = document.createElement("div");
        rightIconDiv.classList.add("icon-cell_right");
        let iconInfo = document.createElement("i");
        iconInfo.classList.add("material-icons");
        iconInfo.innerHTML = "warning";
        rightIconDiv.appendChild(iconInfo);
        tdInfo.appendChild(rightIconDiv);

        tr.appendChild(tdName);
        tr.appendChild(tdSize);
        tr.appendChild(tdInfo);

        return tr;
    }
}