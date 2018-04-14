
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
            a.onclick = function (event) {
                //Open the selected rootfolder and activate the corresponding drawer button
                this.hcs.rootFolderList.selected = rf;
                this.openFolder(rf + "/", true);
                for (let child of this.drawerRootFolderList.childNodes) {
                    if (child.classList) child.classList.remove("navigation__link--selected");
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



        //region The snackbar reference, used as notification
        this.notification = document.querySelector('#snackbar');
        //endregion

        //region The upper right menu, sorting buttons
        this.orderByTypeBtn = document.getElementById("orderByTypeBtn");
        this.orderByNameBtn = document.getElementById("orderByNameBtn");
        this.orderByTypeBtn.onclick = function () { this.buildFileTree(undefined, this.fileTree, false) }.bind(this);
        this.orderByNameBtn.onclick = function () { this.buildFileTreeByName(undefined, this.fileTree, false) }.bind(this);
        //endregion

        //region Creating the wait, not-found and error table row
        this.cachedWaitingTableRow = this.createWaitingTableRow(); //The loading placeholder entry of the file table
        //Creating the NotFound table row
        this.cachedNotFoundTableRow = this.createNotFoundTableRow();
        //Creating the error table row
        this.cachedErrorTableRow = this.createErrorTableRow();

        this.fileTableBody = document.getElementById("fileTableBody");
        this.pathArrowContainer = document.getElementById("pathArrowContainer");
        //endregion

        //region Setting up the info dialog
        this.infoDialog = document.getElementById("fileInfoDialog");
        //Setting the close button once
        this.infoDialog.closeBtn = document.querySelector("#fileInfoDialog .close");
        this.infoDialog.closeBtn.onclick = function () {
            this.close();
        }.bind(this.infoDialog);
        //Retrieving all dialog fields
        this.infoDialog.titleLable = document.querySelector("#fileInfoDialog #dialogTitle");
        this.infoDialog.pathLable = document.querySelector("#fileInfoDialog #dialogPath");
        this.infoDialog.typeLable = document.querySelector("#fileInfoDialog #dialogType");
        this.infoDialog.sizeLable = document.querySelector("#fileInfoDialog #dialogSize");
        this.infoDialog.lastModifiedLable = document.querySelector("#fileInfoDialog #dialogLastModified");
        this.infoDialog.linkShareLable = document.querySelector("#fileInfoDialog #dialogLinkShare");
        this.infoDialog.publicShareLable = document.querySelector("#fileInfoDialog #dialogPublicShare");
        //Retrieving all dialog buttons
        this.infoDialog.downloadBtn = document.querySelector("#fileInfoDialog #dialogDownloadFile");
        this.infoDialog.deleteBtn = document.querySelector("#fileInfoDialog #dialogDeleteFile");
        this.infoDialog.publicShareBtn = document.querySelector("#fileInfoDialog #dialogPublicShareFile");
        this.infoDialog.linkShareBtn = document.querySelector("#fileInfoDialog #dialogLinkShareFile");
        this.infoDialog.renameBtn = document.querySelector("#fileInfoDialog #dialogRenameFile");
        this.infoDialog.cutBtn = document.querySelector("#fileInfoDialog #dialogCutFile");
        this.infoDialog.copyBtn = document.querySelector("#fileInfoDialog #dialogCopyFile");
        //endregion

        //region Setting up the dialog to choose the folder/file name
        this.chooseNameDialog = document.getElementById("chooseNameDialog");
        //Setting the close button once
        this.chooseNameDialog.closeBtn = document.querySelector("#chooseNameDialog .close");
        this.chooseNameDialog.closeBtn.onclick = function () {
            this.close();
            this.newNameInputBar.blur();
        }.bind(this.chooseNameDialog);
        this.chooseNameDialog.newNameInputBar = document.querySelector("#chooseNameDialog #newNameInputDialog");
        //Retrieving all dialog buttons
        this.chooseNameDialog.selectBtn = document.querySelector("#chooseNameDialog #dialogSelectNewName");
        //endregion

        //region Setting up the input bar to change path
        this.changePathForm = document.getElementById("changePathForm");
        this.changePathBar = document.getElementById("changePathBar");
        this.changePathForm.onsubmit = function (event) {
            event.preventDefault();
            this.openFolder(this.changePathBar.value);
            this.changePathForm.blur();
        }.bind(this);
        //The focus is on the input element inside the overall div container, but the is-dirty class is on the div, so remove it from the div on the input blur
        this.changePathForm.querySelector("input").addEventListener("blur", function (event) {
            this.changePathForm.children[0].classList.remove("is-dirty");
        }.bind(this));
        //Work around a bug, sometimes soon after the page loads, the changePathBar stays open
        this.changePathForm.blur();
        //endregion

        //region Setting up the cut dialog and button
        this.clipboardCutDialog = document.getElementById("clipboardCutDialog");
        this.clipboardCutDialog.table = document.querySelector("#clipboardCutDialog table");
        //Set up the list of all the files and the master checkbox behaviour
        (function () {
            this.clipboardCutDialog.rowList = [];

            var table = this.clipboardCutDialog.table;
            var headerCheckbox = table.querySelector('thead .mdl-data-table__select input');
            this.clipboardCutDialog.headerCheckbox = headerCheckbox;
            var headerCheckHandler = function (event) {
                var boxes = table.querySelectorAll('tbody .mdl-data-table__select');
                if (event.target.checked) {
                    for (var i = 0, length = boxes.length; i < length; i++) {
                        boxes[i].MaterialCheckbox.check();
                    }
                } else {
                    for (var i = 0, length = boxes.length; i < length; i++) {
                        boxes[i].MaterialCheckbox.uncheck();
                    }
                }
            };
            headerCheckbox.addEventListener('change', headerCheckHandler);
        }.bind(this))();
        this.clipboardCutDialog.tableBody = document.querySelector("#clipboardCutDialog tbody");
        this.clipboardCutDialog.closeBtn = document.querySelector("#clipboardCutDialog .close");
        this.clipboardCutDialog.closeBtn.onclick = function () {
            this.close();
        }.bind(this.clipboardCutDialog);
        this.clipboardCutDialog.pasteBtn = document.querySelector("#clipboardCutDialog #dialogPasteSelected");
        this.clipboardCutDialog.pasteSelected = function () {
            //Eventually remove the headerCheckBox
            this.clipboardCutDialog.headerCheckbox.parentElement.MaterialCheckbox.uncheck();

            let toCut = [];
            for (let tr of this.clipboardCutDialog.rowList) {
                if (tr.checked) toCut.push(tr);
            }
            if (toCut.length == 0) return;
            else if (toCut.length == 1) {
                toCut[0].btn.click();
                this.clipboardCutDialog.close();
                return;
            }
            let commonError;
            let promises = [];
            //Create an array of promises. They all resolve, but if there is an error, the promise is resolved returning the file name,
            //and commonError will be set to the error
            for (let tr of toCut) {
                let p = new Promise(function (resolve, reject) {
                    tr.cut(this.hcs.currentFolder, function (err) {
                        if(err && err == "OverwriteDenied"){
                            resolve();
                        }
                        else if (err) {
                            commonError = err;
                            resolve(tr.name);
                        }
                        else {
                            resolve();
                        }
                    }.bind(this));
                }.bind(this));
                promises.push(p);
            }
            Promise.all(promises).then(function (names) {
                if (commonError) {

                    var data = {
                        message: "Error moving files (" + names[0] + " and others)",
                        actionHandler: function (event) { }.bind(this),
                        actionText: 'Retry',
                        timeout: 3000
                    };
                    this.notification.MaterialSnackbar.showSnackbar(data);
                }
                else {
                    var data = {
                        message: "Files moved",
                        timeout: 3000
                    };
                    this.notification.MaterialSnackbar.showSnackbar(data);
                }
                this.openFolder(undefined, false, false);
                this.clipboardCutDialog.close();
            }.bind(this));
        }.bind(this);
        this.clipboardCutDialog.pasteBtn.onclick = this.clipboardCutDialog.pasteSelected;
        this.openCutDialogBtn = document.getElementById("openCutDialogBtn");
        this.openCutDialogBtn.badge = this.openCutDialogBtn.parentElement;
        this.openCutDialogBtn.badge.updateBadge = function () {
            this.clipboardCutDialog.rowList.length != 0
                ? this.openCutDialogBtn.badge.setAttribute("data-badge", this.clipboardCutDialog.rowList.length)
                : this.openCutDialogBtn.badge.removeAttribute("data-badge");
        }.bind(this);
        this.openCutDialogBtn.badge.updateBadge();
        this.openCutDialogBtn.onclick = function () {
            this.showModal();
        }.bind(this.clipboardCutDialog);
        //Creating the template
        (function () {
            let tr = document.createElement("tr");

            let td0 = document.createElement("td");
            let label0 = document.createElement("label");
            label0.classList.add("mdl-checkbox", "mdl-js-checkbox", "mdl-js-ripple-effect", "mdl-data-table__select");
            let checkbox = document.createElement("input");
            checkbox.setAttribute("type", "checkbox");
            checkbox.classList.add("mdl-checkbox__input");
            componentHandler.upgradeElement(checkbox);
            label0.appendChild(checkbox);
            td0.appendChild(label0);

            let td1 = document.createElement("td");
            td1.classList.add("mdl-data-table__cell--non-numeric");
            let div1 = document.createElement("div");
            div1.classList.add("icon-cell_left");
            let icon1 = document.createElement("i");
            icon1.classList.add("material-icons");
            icon1.innerText = "content_cut";
            let span = document.createElement("span");
            div1.appendChild(icon1);
            div1.appendChild(span);
            td1.appendChild(div1);

            let td2 = document.createElement("td");
            let div2 = document.createElement("div");
            div2.classList.add("icon-cell_right");
            let btn = document.createElement("button");
            btn.classList.add("mdl-button", "mdl-js-button", "mdl-button--icon", "paste");
            let icon2 = document.createElement("i");
            icon2.classList.add("material-icons");
            icon2.innerText = "content_paste";
            btn.appendChild(icon2);
            div2.appendChild(btn);
            td2.appendChild(div2);

            let td3 = document.createElement("td");
            let div3 = document.createElement("div");
            div3.classList.add("icon-cell_right");
            let btn3 = document.createElement("button");
            btn3.classList.add("mdl-button", "mdl-js-button", "mdl-button--icon", "remove");
            let icon3 = document.createElement("i");
            icon3.classList.add("material-icons");
            icon3.innerText = "close";
            btn3.appendChild(icon3);
            div3.appendChild(btn3);
            td3.appendChild(div3);

            tr.appendChild(td0);
            tr.appendChild(td1);
            tr.appendChild(td2);
            tr.appendChild(td3);

            this.clipboardCutDialog.tableRowTemplate = tr;

            this.clipboardCutDialog.addRow = function (name, path) {
                //Creating and adding the DOM element
                var tr = this.clipboardCutDialog.tableRowTemplate.cloneNode(true);
                tr.querySelector("span").innerText = name;
                this.clipboardCutDialog.tableBody.appendChild(tr);
                //MDL component needs to be upgraded
                componentHandler.upgradeElement(tr.querySelector("label"));

                this.clipboardCutDialog.rowList.push(tr);
                this.openCutDialogBtn.badge.updateBadge();

                //Define the checked property on the tr so that is not needed to query the checkbox everytime
                Object.defineProperty(tr, "checked", {
                    get: function () {
                        return tr.querySelector("input").checked;
                    }
                });
                tr.name = name; //The name of the file
                tr.path = path; //The current path of the file/folder
                /** 
                 * Function to cut the file
                 * @param {String} newPath - The path, WITHOUT THE FILE NAME, to move the file to
                 * @param {Function} callback - The completition callback, recives an error
                */
                tr.cut = function (newPath, callback) {
                    //Check if something will be overwritten and ask the user
                    for(let i in this.fileTree.fileList){
                        let overwriteFile = this.fileTree.fileList[i];
                        if(name == overwriteFile.name){
                            //If the user doesn't want to overwrite the file, send a special error
                            if(!confirm(`Overwriting ${name} ?`)){
                                callback("OverwriteDenied");
                                return;
                            }
                            else{
                                break;
                            }
                        }
                    }
                    this.clipboardCutDialog.rowList.splice(this.clipboardCutDialog.rowList.indexOf(tr), 1);
                    tr.remove();
                    this.openCutDialogBtn.badge.updateBadge();

                    newPath = newPath + tr.name;
                    this.hcs.requestMoveFile(path, newPath, callback);
                }.bind(this);

                tr.btn = tr.querySelector("button.paste");
                tr.btn.onclick = function () {
                    tr.cut(this.hcs.currentFolder, function (err) {
                        if(err && err == "OverwriteDenied"){
                            var data = {
                                message: tr.name + " not moved",
                                timeout: 3000
                            };
                            this.notification.MaterialSnackbar.showSnackbar(data);
                        }
                        else if (err) {
                            var data = {
                                message: "Error moving " + tr.name,
                                actionHandler: function (event) { this.onclick() }.bind(btn),
                                actionText: 'Retry',
                                timeout: 3000
                            };
                            this.notification.MaterialSnackbar.showSnackbar(data);
                        }
                        else {
                            var data = {
                                message: tr.name + " moved",
                                timeout: 3000
                            };
                            this.notification.MaterialSnackbar.showSnackbar(data);
                        }
                        this.openFolder(undefined, false, false);
                        this.clipboardCutDialog.close();
                    }.bind(this));
                }.bind(this);

                tr.removeBtn = tr.querySelector("button.remove");
                tr.removeBtn.onclick = function(){
                    this.clipboardCutDialog.rowList.splice(this.clipboardCutDialog.rowList.indexOf(tr), 1);
                    tr.remove();
                    this.openCutDialogBtn.badge.updateBadge();
                }.bind(this);

                return tr;
            }.bind(this);


        }.bind(this))();
        //endregion

        //region Setting up the copy dialog and button
        this.clipboardCopyDialog = document.getElementById("clipboardCopyDialog");
        this.clipboardCopyDialog.table = document.querySelector("#clipboardCopyDialog table");
        //Set up the list of all the files and the master checkbox behaviour
        (function () {
            this.clipboardCopyDialog.rowList = [];

            var table = this.clipboardCopyDialog.table;
            var headerCheckbox = table.querySelector('thead .mdl-data-table__select input');
            this.clipboardCopyDialog.headerCheckbox = headerCheckbox;
            var headerCheckHandler = function (event) {
                var boxes = table.querySelectorAll('tbody .mdl-data-table__select');
                if (event.target.checked) {
                    for (var i = 0, length = boxes.length; i < length; i++) {
                        boxes[i].MaterialCheckbox.check();
                    }
                } else {
                    for (var i = 0, length = boxes.length; i < length; i++) {
                        boxes[i].MaterialCheckbox.uncheck();
                    }
                }
            };
            headerCheckbox.addEventListener('change', headerCheckHandler);
        }.bind(this))();
        this.clipboardCopyDialog.tableBody = document.querySelector("#clipboardCopyDialog tbody");
        this.clipboardCopyDialog.closeBtn = document.querySelector("#clipboardCopyDialog .close");
        this.clipboardCopyDialog.closeBtn.onclick = function () {
            this.close();
        }.bind(this.clipboardCopyDialog);
        this.clipboardCopyDialog.pasteBtn = document.querySelector("#clipboardCopyDialog #dialogPasteSelected");
        this.clipboardCopyDialog.pasteSelected = function () {
            //Eventually remove the headerCheckBox
            this.clipboardCopyDialog.headerCheckbox.parentElement.MaterialCheckbox.uncheck();

            let toCopy = [];
            for (let tr of this.clipboardCopyDialog.rowList) {
                if (tr.checked) toCopy.push(tr);
            }
            if (toCopy.length == 0) return;
            else if (toCopy.length == 1) {
                toCopy[0].btn.click();
                this.clipboardCopyDialog.close();
                return;
            }
            let commonError;
            let promises = [];
            //Create an array of promises. They all resolve, but if there is an error, the promise is resolved returning the file name,
            //and commonError will be set to the error
            for (let tr of toCopy) {
                let p = new Promise(function (resolve, reject) {
                    tr.copy(this.hcs.currentFolder, function (err) {
                        if(err && err == "OverwriteDenied"){
                            resolve();
                        }
                        else if (err) {
                            commonError = err;
                            resolve(tr.name);
                        }
                        else {
                            resolve();
                        }
                    }.bind(this));
                }.bind(this));
                promises.push(p);
            }
            Promise.all(promises).then(function (names) {
                if (commonError) {

                    var data = {
                        message: "Error copying files (" + names[0] + " and others)",
                        actionHandler: function (event) { }.bind(this),
                        actionText: 'Retry',
                        timeout: 3000
                    };
                    this.notification.MaterialSnackbar.showSnackbar(data);
                }
                else {
                    var data = {
                        message: "Files copied",
                        timeout: 3000
                    };
                    this.notification.MaterialSnackbar.showSnackbar(data);
                }
                this.openFolder(undefined, false, false);
                this.clipboardCopyDialog.close();
            }.bind(this));
        }.bind(this);
        this.clipboardCopyDialog.pasteBtn.onclick = this.clipboardCopyDialog.pasteSelected;
        this.openCopyDialogBtn = document.getElementById("openCopyDialogBtn");
        this.openCopyDialogBtn.badge = this.openCopyDialogBtn.parentElement;
        this.openCopyDialogBtn.badge.updateBadge = function () {
            this.clipboardCopyDialog.rowList.length != 0
                ? this.openCopyDialogBtn.badge.setAttribute("data-badge", this.clipboardCopyDialog.rowList.length)
                : this.openCopyDialogBtn.badge.removeAttribute("data-badge");
        }.bind(this);
        this.openCopyDialogBtn.badge.updateBadge();
        this.openCopyDialogBtn.onclick = function () {
            this.showModal();
        }.bind(this.clipboardCopyDialog);
        //Creating the template
        (function () {
            let tr = document.createElement("tr");

            let td0 = document.createElement("td");
            let label0 = document.createElement("label");
            label0.classList.add("mdl-checkbox", "mdl-js-checkbox", "mdl-js-ripple-effect", "mdl-data-table__select");
            let checkbox = document.createElement("input");
            checkbox.setAttribute("type", "checkbox");
            checkbox.classList.add("mdl-checkbox__input");
            componentHandler.upgradeElement(checkbox);
            label0.appendChild(checkbox);
            td0.appendChild(label0);

            let td1 = document.createElement("td");
            td1.classList.add("mdl-data-table__cell--non-numeric");
            let div1 = document.createElement("div");
            div1.classList.add("icon-cell_left");
            let icon1 = document.createElement("i");
            icon1.classList.add("material-icons");
            icon1.innerText = "content_copy";
            let span = document.createElement("span");
            div1.appendChild(icon1);
            div1.appendChild(span);
            td1.appendChild(div1);

            let td2 = document.createElement("td");
            let div2 = document.createElement("div");
            div2.classList.add("icon-cell_right");
            let btn = document.createElement("button");
            btn.classList.add("mdl-button", "mdl-js-button", "mdl-button--icon", "paste");
            let icon2 = document.createElement("i");
            icon2.classList.add("material-icons");
            icon2.innerText = "content_paste";
            btn.appendChild(icon2);
            div2.appendChild(btn);
            td2.appendChild(div2);

            let td3 = document.createElement("td");
            let div3 = document.createElement("div");
            div3.classList.add("icon-cell_right");
            let btn3 = document.createElement("button");
            btn3.classList.add("mdl-button", "mdl-js-button", "mdl-button--icon", "remove");
            let icon3 = document.createElement("i");
            icon3.classList.add("material-icons");
            icon3.innerText = "close";
            btn3.appendChild(icon3);
            div3.appendChild(btn3);
            td3.appendChild(div3);

            tr.appendChild(td0);
            tr.appendChild(td1);
            tr.appendChild(td2);
            tr.appendChild(td3);

            this.clipboardCopyDialog.tableRowTemplate = tr;

            this.clipboardCopyDialog.addRow = function (name, path) {
                //Creating and adding the DOM element
                var tr = this.clipboardCopyDialog.tableRowTemplate.cloneNode(true);
                tr.querySelector("span").innerText = name;
                this.clipboardCopyDialog.tableBody.appendChild(tr);
                //MDL component needs to be upgraded
                componentHandler.upgradeElement(tr.querySelector("label"));

                this.clipboardCopyDialog.rowList.push(tr);
                this.openCopyDialogBtn.badge.updateBadge();

                //Define the checked property on the tr so that is not needed to query the checkbox everytime
                Object.defineProperty(tr, "checked", {
                    get: function () {
                        return tr.querySelector("input").checked;
                    }
                });
                tr.name = name; //The name of the file
                tr.path = path; //The current path of the file/folder
                /** 
                 * Function to copy the file
                 * @param {String} newPath - The path, WITHOUT THE FILE NAME, to copy the file to
                 * @param {Function} callback - The completition callback, recives an error
                */
                tr.copy = function (newPath, callback) {
                    //Check if something will be overwritten and ask the user
                    for(let i in this.fileTree.fileList){
                        let overwriteFile = this.fileTree.fileList[i];
                        if(name == overwriteFile.name){
                            //If the user doesn't want to overwrite the file, send a special error
                            if(!confirm(`Overwriting ${name} ?`)){
                                callback("OverwriteDenied");
                                return;
                            }
                            else{
                                break;
                            }
                        }
                    }
                    this.clipboardCopyDialog.rowList.splice(this.clipboardCopyDialog.rowList.indexOf(tr), 1);
                    tr.remove();
                    this.openCopyDialogBtn.badge.updateBadge();

                    newPath = newPath + tr.name;
                    this.hcs.requestCopyFile(path, newPath, callback);
                }.bind(this);

                tr.btn = tr.querySelector("button");
                tr.btn.onclick = function () {
                    tr.copy(this.hcs.currentFolder, function (err) {
                        if(err && err == "OverwriteDenied"){
                            var data = {
                                message: tr.name + " not copied",
                                timeout: 3000
                            };
                            this.notification.MaterialSnackbar.showSnackbar(data);
                        }
                        else if (err) {
                            var data = {
                                message: "Error copying " + tr.name,
                                actionHandler: function (event) { this.onclick() }.bind(btn),
                                actionText: 'Retry',
                                timeout: 3000
                            };
                            this.notification.MaterialSnackbar.showSnackbar(data);
                        }
                        else {
                            var data = {
                                message: tr.name + " copied",
                                timeout: 3000
                            };
                            this.notification.MaterialSnackbar.showSnackbar(data);
                        }
                        this.openFolder(undefined, false, false);
                        this.clipboardCopyDialog.close();
                    }.bind(this));
                }.bind(this);

                tr.removeBtn = tr.querySelector("button.remove");
                tr.removeBtn.onclick = function(){
                    this.clipboardCopyDialog.rowList.splice(this.clipboardCopyDialog.rowList.indexOf(tr), 1);
                    tr.remove();
                    this.openCopyDialogBtn.badge.updateBadge();
                }.bind(this);


                return tr;
            }.bind(this);


        }.bind(this))();
        //endregion

        //region Setting up upload button
        this.addFileBtn = document.getElementById("addFileButton");
        this.bottomProgressBar = document.getElementById("bottomProgressBar");
        this.uploadInfoDiv = document.getElementById("uploadInfo");
        this.addFileBtn.onclick = function () {
            //Open the file picker
            let filePicker = document.getElementById("filePicker");
            //Upload the file once the filepicker has some files selected
            filePicker.onchange = function () {
                this.uploadFile(filePicker.files);
            }.bind(this);
            filePicker.click();
        }.bind(this);
        //endregion

        //region Setting up the drag and drop system
        var dropArea = document.getElementById("drop-hint-area");
        var invisibleDropArea = document.getElementById("invisible-drop-area");
        var headerbar = document.querySelector("header");
        var navbar = document.getElementById("full-navbar");
        var bouncingText = document.querySelector("#inner-border h4");
        var target;
        window.addEventListener("drag", function (event) {
            console.log("drag");
            if(event.dataTransfer.types.includes("Files")) {
                //Prevent default browser behavior if files are being draged
                event.preventDefault();
            }
        });
        //Useless drag events
        /*
        window.addEventListener("dragstart", function (event) {
            console.log("dragstart");
            console.log(event.target);
        });
        window.addEventListener("dragexit", function (event) {
            console.log("dragexit");
            console.log(event.target);
        });
        window.addEventListener("dragend", function (event) {
            console.log("dragend");
            console.log(event.target);
        });
        */
        window.addEventListener("dragover", function (event) {

            if(event.dataTransfer.types.includes("Files")) {
                //Prevent default browser behavior if files are being draged
                event.preventDefault();
                dropArea.classList.add("visible");
                bouncingText.classList.add("bounce");
                headerbar.style.zIndex = 0;
                navbar.style.zIndex = 0;
            } 
            else {
                //If there are no files, this isn't the drag we care about
                dropArea.classList.remove("visible");
                bouncingText.classList.remove("bounce");
                headerbar.style.zIndex = "";
                navbar.style.zIndex = "";
            } 
        });
        window.addEventListener("dragleave", function (event) {

            if(event.dataTransfer.types.includes("Files")) {
                //Prevent default browser behavior if files are being draged
                event.preventDefault();
                if(event.target == invisibleDropArea){
                    dropArea.classList.remove("visible");
                    bouncingText.classList.remove("bounce");
                    headerbar.style.zIndex = "";
                    navbar.style.zIndex = "";
                }
            }
        });
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
            //Hiding the drop area
            dropArea.classList.remove("visible");
            bouncingText.classList.remove("bounce");
            headerbar.style.zIndex = "";
            navbar.style.zIndex = "";

            if (this.addFileBtn.disabled) {
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
            if (files.length != 0) {
                this.uploadFile(files);
            }
        }.bind(this);
        //endregion

        //region Setting up the create new folder button
        this.addFolderBtn = document.getElementById("addFolderButton");
        this.addFolderBtn.onclick = this.addFolder.bind(this);
        //endregion

        //region Setting up the drawer's button to open the recycle bin
        this.recycleBinBtn = document.getElementById("recycleBinBtn");
        this.recycleBinBtn.onclick = function (event) {
            //Close the drawer after click
            this.toggleDrawer(this.drawer);
            //Open the folder
            this.openTrashFolder();
        }.bind(this);
        //endregion

        //region Setting up the drawer's button to open the public share folder
        this.publicShareFolderBtn = document.getElementById("drawerPublicShareBtn");
        this.publicShareFolderBtn.onclick = function (event) {
            //Close the drawer after click
            this.toggleDrawer(this.drawer);
            //Open the folder
            this.openPublicShareFolder();
        }.bind(this);
        //endregion

        //region Setting up the drawer's button to open the link share folder
        this.publicLinkFolderBtn = document.getElementById("drawerLinkShareBtn");
        this.publicLinkFolderBtn.onclick = function (event) {
            //Close the drawer after click
            this.toggleDrawer(this.drawer);
            //Open the folder
            this.openLinkShareFolder();
        }.bind(this);
        //endregion

        //region Setting up the search bar, so that when enter is clicked the search is launched
        this.navBarSearchBtn = document.getElementById("navBarSearchButton");
        this.searchBar = document.getElementById("searchInputBar");
        this.searchBarForm = document.getElementById("fileSearchForm");
        this.searchBarForm.onsubmit = function (ev) {
            ev.preventDefault();
            this.openSearchFolder(undefined, this.searchBar.value);
            this.navBarSearchBtn.MaterialTextfield.change("");
            this.navBarSearchBtn.blur();
        }.bind(this);
        //The focus is on the input element inside the overall div container, but the is-dirty class is on the div, so remove it from the div on the input blur
        this.searchBar.addEventListener("blur", function (event) {
            this.navBarSearchBtn.classList.remove("is-dirty");
        }.bind(this));
        //endregion

        //region Setting up the multiple selection handling system
        this.multipleSelection = {};
        this.multipleSelection.infoBtn = document.getElementById("openMultiselectionInfoBtn");
        this.multipleSelection.badge = this.multipleSelection.infoBtn.parentElement;
        this.multipleSelection.update = function(){
            let selected = document.querySelectorAll("tr.selected");
            if(selected.length > 0){
                this.multipleSelection.badge.classList.remove("invisible");
                this.multipleSelection.badge.setAttribute("data-badge",selected.length);
            }
            else{
                this.multipleSelection.badge.classList.add("invisible");
            }
        }.bind(this);

        this.multipleSelection.infoBtn.onclick = function(){
            let selected = document.querySelectorAll("tr.selected");
            //If the multipleSelection info button is showing but no file was selected
            //there was an error, update the interface to fix the problem
            if(selected.length == 0){
                this.multipleSelection.update();
                return;
            }
            let files = [];
            let canShare = true;
            let canCopy = true;
            let canCut = true;
            selected.forEach(function(tr){
                files.push(tr.fileSystemObj);
                canShare = canShare && tr.canOptions.canShare;
                canCopy = canCopy && tr.canOptions.canCopy;
                canCut = canCut && tr.canOptions.canCut;
            });
            this.showMultipleFileInfo(files,selected,canShare,canCut,canCopy);
        }.bind(this);
        //endregion

        //region Seting up the popstate event so that it handles back button clicks
        window.onpopstate = this.handleBackButton.bind(this);
        //endregion

        this.buildFileTree = this.buildFileTree.bind(this);
        this.openFolder = this.openFolder.bind(this);
        this.openTrashFolder = this.openTrashFolder.bind(this);
        this.openPublicShareFolder = this.openPublicShareFolder.bind(this);
        this.openLinkShareFolder = this.openLinkShareFolder.bind(this);
        this.openSearchFolder = this.openSearchFolder.bind(this);
        this.uploadFile = this.uploadFile.bind(this);
        this.addFolder = this.addFolder.bind(this);
        this.openFile = this.openFile.bind(this);
    }


    /**
     * Handle the back button pressed when triggers a popevent
     * @param {DOMEvent} event - The event with the state in it 
     */
    handleBackButton(event) {
        var state = event.state
        if (!state) {
            //Navigated to the first page that doesn't have any state.
            //Simply ignore this event
            return;
        }
        if (state.type == "general") {
            this.openFolder(state.path, false);
        }
        else if (state.type == "trash") {
            this.openTrashFolder(state.path, false);
        }
        else if (state.type == "publicshare") {
            this.openPublicShareFolder(state.path, false);
        }
        else if (state.type == "linkshare") {
            this.openLinkShareFolder(state.path, false);
        }
        else if (state.type == "search") {
            this.openSearchFolder(state.path, state.searchString, false);
        }
    }


    openFolder(path, updateHistory = true, replacePreviousHistoryState = false) {

        //Clear the table and show a loading indication
        while (this.fileTableBody.firstChild) {
            this.fileTableBody.removeChild(this.fileTableBody.firstChild);
        }
        //Upgrading the element for MDL rendering
        window.componentHandler.upgradeElements(this.cachedWaitingTableRow);
        this.fileTableBody.appendChild(this.cachedWaitingTableRow);

        //Updating the multiple selection info icon to not show it
        this.multipleSelection.update();

        if (!path) {
            //If path is undefined use the current synced directly
            path = this.hcs.currentFolder;

            //Check if the folder is a special folder
            if (path.includes("$hcs$trash")) {
                this.openTrashFolder(path, true, false);
                return;
            }
            else if (path.includes("$hcs$publicshare")) {
                this.openPublicShareFolder(path, true, false);
                return;
            }
            else if (path.includes("$hcs$linkshare")) {
                this.openLinkShareFolder(path, true, false);
                return;
            }

            //Else, open this folder normaly
            this.hcs.requestFileTree(path, 1, this.buildFileTree);

            //Enable file upload button and add folder button if not uploading
            if (!this.isUploadingFile) {
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
                    if (!this.isUploadingFile) {
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
                        actionHandler: function (event) { this.openFolder(path, false) }.bind(this),
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
                        actionHandler: function (event) { this.openFolder(path, false) }.bind(this),
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

        //Updating the multiple selection info icon to not show it
        this.multipleSelection.update();

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
                        this.buildFileTree(err, fileTree, true, true, true, undefined, { $hcs$trash: "Recycle Bin" }, { canShare: false, canCopy: false });
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

        //Updating the multiple selection info icon to not show it
        this.multipleSelection.update();

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
                    this.hcs.requestFileTree(newPath, 1, function (err, fileTree) {
                        this.buildFileTree(err, fileTree, true, true, true, undefined, { $hcs$publicshare: "Public Share" }, { canShare: false, canCut: false, canCopy: false });
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

        //Updating the multiple selection info icon to not show it
        this.multipleSelection.update();

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
                    this.hcs.requestFileTree(newPath, 1, function (err, fileTree) {
                        this.buildFileTree(err, fileTree, true, true, true, undefined, { $hcs$linkshare: "Link Share" }, { canShare: false, canCut: false, canCopy: false });
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

    openSearchFolder(path, searchString, updateHistory = true, replacePreviousHistoryState = false) {

        //Clear the table and show a loading indication
        while (this.fileTableBody.firstChild) {
            this.fileTableBody.removeChild(this.fileTableBody.firstChild);
        }
        //Upgrading the element for MDL rendering
        window.componentHandler.upgradeElements(this.cachedWaitingTableRow);
        this.fileTableBody.appendChild(this.cachedWaitingTableRow);

        //Updating the multiple selection info icon to not show it
        this.multipleSelection.update();

        if (!path) {
            //If path is undefined use the current synced directly
            path = this.hcs.currentFolder;
        }

        //Else, open this folder normaly
        this.hcs.requestSearchFileTree(path, searchString, function (err, fileTree) {
            if (err == 404) {

                var data = {
                    message: path + " Not Found",
                    actionHandler: function (event) { this.openSearchFolder(path, searchString, false) }.bind(this),
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
            else if (err) {

                var data = {
                    message: `Error searching "${searchString}": ${err}`,
                    actionHandler: function (event) { this.openSearchFolder(path, false) }.bind(this),
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
            let searchModPath = path.endsWith("/") ? path + `Search: ${searchString}` : path + `/Search: ${searchString}`;
            //Call buildFileTree in whichever case because it is going to handle to error by it self (placing the error table row)
            this.buildFileTree(err, fileTree, true, true, true, searchModPath, undefined, { updateChangePathBar: false });
        }.bind(this));

        //Disable file upload button and add folder button
        this.addFileBtn.disabled = true;
        this.addFolderBtn.disabled = true;
        this.inSpecialFolder = true; //Used to tell to other components that we are in a special folder

        //Update the history state if requested and also if the last state is not the same as the one we are trying to update
        if (updateHistory && !(history.state && history.state.searchString == searchString && history.state.path == path)) {
            let state = {
                path: path,
                searchString: searchString,
                type: "search"
            };
            if (history.state && history.state.searchString == searchString && history.state.path == state.path) {
                return;
            }

            if (replacePreviousHistoryState) {
                window.history.replaceState(state, "HCS", "/");
            }
            else {
                window.history.pushState(state, "HCS", "/");
            }
            console.log("Updating history with " + state.path + " - search");
        }
    }


    /**
     * Builds the arrow path on top of the file table
     * @param {String} arrowPath - A path shown with one arrow for each folcer
     * @param {Object} arrowPathReplacements - A dictionary with a value replacement for some folder names in the arrow path
     * @param {String | Boolean} [updateChangePathBar = true] - If true the path bar gets updated with arrowPath, if a string the path bat gets updated with it
     */
    buildArrowPath(arrowPath, arrowPathReplacements = {}, updateChangePathBar = true) {
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
        if (updateChangePathBar == true) {
            this.changePathBar.value = arrowPath;
        }
        else if (updateChangePathBar) {
            this.changePathBar.value = updateChangePathBar;
        }

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
     * @param {Boolean} [options.canCut = true] - Sets the cut button in the info dialog enabled or disabled
     * @param {Boolean} [options.canCopy = true] - Sets the copy button in the info dialog enabled or disabled
     * @param {String | Boolean} [options.updateChangePathBar = true] - If true the path bar gets updated with customArrowPath, if a string the path bat gets updated with it 
     */
    buildFileTree(err, fileTree, updateFTState = true, printFolders = true, printFiles = true, customArrowPath, arrowPathReplacements = {}, options = {}) {
        if (updateFTState) this.fileTree = fileTree;
        //Remove all child nodes present at this moment
        while (this.fileTableBody.firstChild) {
            this.fileTableBody.removeChild(this.fileTableBody.firstChild);
        }

        if (err) {
            this.fileTableBody.appendChild(this.cachedErrorTableRow);
            return;
        }

        //Create path arrows
        this.buildArrowPath(customArrowPath || fileTree.path, arrowPathReplacements, options.updateChangePathBar);

        //Holds a list of all the tr in the table
        this.allTableRow = [];

        //Create all the directories' table row
        if (printFolders) {
            for (let dir of fileTree.dirList) {
                let tr = document.createElement("tr");
                tr.setAttribute("data-hcsname", dir.name);
                tr.name = dir.name;
                tr.fileSystemObj = dir;
                tr.canOptions = options;
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
                    this.showFileInfo(dir, tr, options.canShare, options.canCut, options.canCopy);
                }.bind(this);

                tr.appendChild(tdName);
                tr.appendChild(tdSize);
                tr.appendChild(tdInfo);
                tr.onclick = function (event) {
                    if(!event.ctrlKey){
                        this.openFolder(dir.path);
                    }
                    else if(!tr.classList.contains("selected")){
                        tr.classList.add("selected");
                        this.multipleSelection.update();
                    }
                    else{
                        tr.classList.remove("selected");
                        this.multipleSelection.update();
                    }
                }.bind(this);
                tr.addEventListener("longtouch",()=>{
                    if(!tr.classList.contains("selected")){
                        tr.classList.add("selected");
                        this.multipleSelection.update();
                    }
                    else{
                        tr.classList.remove("selected");
                        this.multipleSelection.update();
                    } 
                });
                this.fileTableBody.appendChild(tr);
                this.allTableRow.push(tr);
            }
        }

        //Create all files' table row
        if (printFiles) {
            for (let file of fileTree.fileList) {
                let tr = document.createElement("tr");
                tr.setAttribute("data-hcsname", file.name);
                tr.name = file.name;
                tr.fileSystemObj = file;
                tr.canOptions = options;
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
                /*
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
                */
                tdSize.innerHTML = this.prettyBytes(file.size);

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
                    this.showFileInfo(file, tr, options.canShare, options.canCut, options.canCopy);
                }.bind(this);

                tr.appendChild(tdName);
                tr.appendChild(tdSize);
                tr.appendChild(tdInfo);
                tr.onclick = function () {
                    if (!event.ctrlKey) {
                        this.openFile(file);
                    }
                    else if(!tr.classList.contains("selected")){
                        tr.classList.add("selected");
                        this.multipleSelection.update();
                    }
                    else{
                        tr.classList.remove("selected");
                        this.multipleSelection.update();
                    }
                }.bind(this);
                tr.addEventListener("longtouch", () => {
                    if(!tr.classList.contains("selected")){
                        tr.classList.add("selected");
                        this.multipleSelection.update();
                    }
                    else{
                        tr.classList.remove("selected");
                        this.multipleSelection.update();
                    }
                });
                this.fileTableBody.appendChild(tr);
                this.allTableRow.push(tr);
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
     * @param {Boolean} [options.canCut = true] - Sets the cut button in the info dialog enabled or disabled
     * @param {Boolean} [options.canCopy = true] - Sets the copy button in the info dialog enabled or disabled
     * @param {String | Boolean} [options.updateChangePathBar = true] - If true the path bar gets updated with customArrowPath, if a string the path bat gets updated with it 
     */
    buildFileTreeByName(err, fileTree, updateFTState = true, printFolders = true, printFiles = true, customArrowPath, arrowPathReplacements = {}, options = {}) {
        if (updateFTState) this.fileTree = fileTree;
        //Remove all child nodes present at this moment
        while (this.fileTableBody.firstChild) {
            this.fileTableBody.removeChild(this.fileTableBody.firstChild);
        }

        if (err) {
            this.fileTableBody.appendChild(this.cachedErrorTableRow);
            return;
        }

        //Create path arrows
        this.buildArrowPath(customArrowPath || fileTree.path, arrowPathReplacements, options.updateChangePathBar);

        //An array where all the table rows are stored and then sorted
        var toSort = [];

        //Create all the directories' table row
        if (printFolders) {
            for (let dir of fileTree.dirList) {
                let tr = document.createElement("tr");
                tr.setAttribute("data-hcsname", dir.name);
                tr.name = dir.name;
                tr.fileSystemObj = dir;
                tr.canOptions = options;
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
                    this.showFileInfo(dir, tr, options.canShare, options.canCut, options.canCopy);
                }.bind(this);

                tr.appendChild(tdName);
                tr.appendChild(tdSize);
                tr.appendChild(tdInfo);
                tr.onclick = function (event) {
                    if(!event.ctrlKey){
                        this.openFolder(dir.path);
                    }
                    else if(!tr.classList.contains("selected")){
                        tr.classList.add("selected");
                        this.multipleSelection.update();
                    }
                    else{
                        tr.classList.remove("selected");
                        this.multipleSelection.update();
                    }
                }.bind(this);
                tr.addEventListener("longtouch",()=>{
                    if(!tr.classList.contains("selected")){
                        tr.classList.add("selected");
                        this.multipleSelection.update();
                    }
                    else{
                        tr.classList.remove("selected");
                        this.multipleSelection.update();
                    } 
                });
                toSort.push(tr);
            }
        }

        //Create all files' table row
        if (printFiles) {
            for (let file of fileTree.fileList) {
                let tr = document.createElement("tr");
                tr.setAttribute("data-hcsname", file.name);
                tr.name = file.name;
                tr.fileSystemObj = file;
                tr.canOptions = options;
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
                /*
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
                */
                tdSize.innerHTML = this.prettyBytes(file.size);

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
                    this.showFileInfo(file, tr, options.canShare, options.canCut, options.canCopy);
                }.bind(this);

                tr.appendChild(tdName);
                tr.appendChild(tdSize);
                tr.appendChild(tdInfo);
                tr.onclick = function () {
                    if (!event.ctrlKey) {
                        this.openFile(file);
                    }
                    else if(!tr.classList.contains("selected")){
                        tr.classList.add("selected");
                        this.multipleSelection.update();
                    }
                    else{
                        tr.classList.remove("selected");
                        this.multipleSelection.update();
                    }
                }.bind(this);
                tr.addEventListener("longtouch", () => {
                    if(!tr.classList.contains("selected")){
                        tr.classList.add("selected");
                        this.multipleSelection.update();
                    }
                    else{
                        tr.classList.remove("selected");
                        this.multipleSelection.update();
                    }
                });
                toSort.push(tr);
            }
        }


        toSort.sort(function (tr1, tr2) {
            if (tr1.getAttribute("data-hcsname").toLowerCase() < tr2.getAttribute("data-hcsname").toLowerCase()) {
                return -1;
            }
            else if (tr1.getAttribute("data-hcsname").toLowerCase() > tr2.getAttribute("data-hcsname").toLowerCase()) {
                return 1;
            }
            else {
                return 0;
            }
        });
        toSort.forEach(function (tr) {
            this.fileTableBody.appendChild(tr);
        }.bind(this));
    }


    showFileInfo(file, tr, canShare = true, canCut = true, canCopy = true) {
        let i = this.infoDialog;
        i.titleLable.innerText = file.name;
        i.pathLable.innerText = file.path;
        i.typeLable.innerText = file.type;
        i.publicShareLable.innerText = (file.publicShared) ? "Yes" : "No";
        i.linkShareLable.innerHTML = (file.linkShared) ? `Yes - <a href="${document.location.origin + file.link}" target="_blank">Sharing link</a>` : "No";
        //If its a file, just parse the size
        if (file.classIndex != 1) {
            //Reset the onclick of the size label from the last folder calculate size function
            i.sizeLable.onclick = undefined;
            i.sizeLable.style.cursor = "";
            i.sizeLable.style.color = "";

            /*
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
            */
           i.sizeLable.innerText = this.prettyBytes(file.size);
        }
        else {
            i.sizeLable.innerText = "Click to calculate size...";
            i.sizeLable.style.cursor = "pointer";
            i.sizeLable.style.color = "rgb(83,109,254)";
            i.sizeLable.onclick = function () {
                i.sizeLable.innerText = "Loading...";
                this.hcs.requestFolderSize(file.path, function (err, size) {
                    i.sizeLable.style.cursor = "";
                    i.sizeLable.style.color = "";
                    if (err) {
                        i.sizeLable.innerText = err;
                    }
                    else {
                        /*
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
                        */
                       i.sizeLable.innerText = this.prettyBytes(size);
                    }
                }.bind(this));
            }.bind(this);
        }
        i.lastModifiedLable.innerText = new Date(file.lastModified).toLocaleString();

        //Set up download button (classIndex == 1 => Directory)
        if (file.classIndex != 1) {
            i.downloadBtn.removeAttribute("disabled");
            i.downloadBtn.onclick = function () {
                let a = document.createElement("a");
                a.setAttribute("href", "/files?req=file&path=" + file.path);
                a.setAttribute("download", file.name);
                a.click();
            }
        }
        else {
            i.downloadBtn.removeAttribute("disabled");
            i.downloadBtn.onclick = function () {
                this.hcs.requestMultiFiles([file.path]);
            }.bind(this);
        }

        //Set up delete button
        i.deleteBtn.onclick = function () {
            let result = confirm(`Are you sure to delete ${file.name} ?`);
            if (result) {
                this.hcs.requestDeleteFile(file.path, function (err) {
                    if (err) {

                        var data = {
                            message: `Error deleting ${file.name}: ${err} `,
                            actionHandler: function (event) { this.click() }.bind(i.deleteBtn),
                            actionText: 'Retry',
                            timeout: 3000
                        };
                        this.notification.MaterialSnackbar.showSnackbar(data);
                    }
                    else {

                        var data = {
                            message: `${file.name} deleted`,
                            timeout: 3000
                        };
                        //Close the dialog and reload the current folder
                        this.infoDialog.close();
                        tr.remove();
                        this.notification.MaterialSnackbar.showSnackbar(data);

                    }
                }.bind(this));
            }
        }.bind(this);

        //Resetting the rename button and then setting it up to rename this element
        //canCopy is used to set it enabled because it possible to rename the file in the same situations when it can be copied
        i.renameBtn.setAttribute("disabled", "disabled");
        i.renameBtn.onclick = undefined;
        if (canCopy) {
            i.renameBtn.removeAttribute("disabled");
            i.renameBtn.onclick = function () {

                let i2 = this.chooseNameDialog;
                i2.selectBtn.onclick = function () {
                    //Weird situation, the root folder is the only one without / and cannot be renamed
                    if(file.path.indexOf("/") == -1){
                        var data = {
                            message: `Error: Cannot rename ${file.name}`,
                            timeout: 3000
                        };
                        this.notification.MaterialSnackbar.showSnackbar(data);
                        return;
                    }

                    if (i2.newNameInputBar.value.trim() != "") {
                        let newName = i2.newNameInputBar.value;
                        let relativePath = file.path.substring(0,file.path.lastIndexOf("/")+1);
                        let newPath = relativePath + newName; 
                        this.hcs.requestMoveFile(file.path, newPath, function (err) {
                            if (err) {
                                var data = {
                                    message: `Error: Cannot rename ${file.name}`,
                                    timeout: 3000
                                };
                                this.notification.MaterialSnackbar.showSnackbar(data);
                            }
                            else {
                                var data = {
                                    message: `${file.name} renamed in ${newName}`,
                                    timeout: 3000
                                };
                                this.notification.MaterialSnackbar.showSnackbar(data);
                                tr.querySelector(".icon-cell_left span").innerText = newName;
                                file.name = newName;
                                file.path = newPath;
                            }
                            i2.close();
                            i2.newNameInputBar.blur();
                        }.bind(this));
                    }
                }.bind(this);

                //Close the info dialog to open the rename one
                i.close();
                //Checking if is a file, if true, adding the extensione in the inputbar
                if(file.classIndex != 1 && file.name.includes(".")){
                    let ext = file.name.substring(file.name.lastIndexOf("."));
                    i2.newNameInputBar.value = ext;
                    i2.newNameInputBar.selecetionStart = i2.newNameInputBar.selectionEnd = 0;
                    //Adding this class is necessary because mdl doesn't support filling inputs programmatically
                    i2.newNameInputBar.parentElement.classList.add("is-dirty");
                }
                //Showing the rename dialog
                i2.showModal();
                i2.newNameInputBar.focus();
            }.bind(this);
        }

        //Resetting the cut button and then setting it up to cut this element
        i.cutBtn.setAttribute("disabled", "disabled");
        i.cutBtn.onclick = undefined;
        if (canCut) {
            i.cutBtn.removeAttribute("disabled");
            i.cutBtn.onclick = function () {
                this.clipboardCutDialog.addRow(file.name, file.path);
                //Close the dialog
                this.infoDialog.close();
            }.bind(this);
        }

        //Resetting the copy button and then setting it up to copy this element
        i.copyBtn.setAttribute("disabled", "disabled");
        i.copyBtn.onclick = undefined;
        if (canCopy) {
            i.copyBtn.removeAttribute("disabled");
            i.copyBtn.onclick = function () {
                this.clipboardCopyDialog.addRow(file.name, file.path);
                //Close the dialog
                this.infoDialog.close();
            }.bind(this);
        }

        //First reset to a general state, then activate share buttons if needed
        i.publicShareBtn.setAttribute("disabled", "disabled");
        i.publicShareBtn.onclick = undefined;
        i.linkShareBtn.setAttribute("disabled", "disabled");
        i.linkShareBtn.onclick = undefined;
        if (canShare == true) {
            //Enable buttons if they have been disabled by previous calls
            i.publicShareBtn.removeAttribute("disabled");
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
                        this.infoDialog.close();
                        this.notification.MaterialSnackbar.showSnackbar(data);
                        //Saving the info in the file manually, no need for another filetree request
                        file.publicShared = true;
                    }
                }.bind(this));
            }.bind(this);

            //If is not a folder (classIndex 1 == Folder)
            if (file.classIndex != 1) {
                i.linkShareBtn.removeAttribute("disabled");
                i.linkShareBtn.onclick = function () {
                    this.hcs.shareFileLink(file.path, function (err, link) {
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
                                message: `${file.name} shared by link - Link in the file info`,
                                /*actionHandler: function (event) { this.notification.MaterialSnackbar.cleanup_() }.bind(this),
                                actionText: 'Close',*/
                                timeout: 3000
                            };
                            //Close the dialog
                            this.infoDialog.close();
                            this.notification.MaterialSnackbar.showSnackbar(data);
                            //Saving the info in the file manually, no need for another filetree request
                            file.linkShared = true;
                            file.link = link;
                        }
                    }.bind(this));
                }.bind(this);
            }
        }

        i.showModal();
    }

    showMultipleFileInfo(files, trs, canShare = true, canCut = true, canCopy = true) {
        if(files.length == 1){
            this.showFileInfo(files[0],trs[0],canShare, canCut, canCopy);
            return;
        }
        let i = this.infoDialog;
        i.titleLable.innerText = files.length + " files";
        i.pathLable.innerText = files[0].path.substring(0,files[0].path.lastIndexOf("/")) + "/*";
        
        i.publicShareLable.innerText = "N.A.";
        i.linkShareLable.innerHTML = "N.A.";
        let fileType = files[0].type;
        let fileClass = files[0].classIndex;
        //If its a file, just parse the size
        //Reset the onclick of the size label from the last folder calculate size function
        i.sizeLable.onclick = undefined;
        i.sizeLable.style.cursor = "";
        i.sizeLable.style.color = "";
        i.sizeLable.innerText = "Loading...";
        var promises = [];
        //Creates an array of promises to calculate the total size of all files and folders + checking for all per file infos that are needed
        files.forEach(function(file){

            if(file.classIndex != fileClass){
                fileClass = null;
            }

            if(file.type != fileType){
                fileType = "Multiple types";
            }

            if (file.classIndex != 1) {
                promises.push(new Promise(function(resolve,reject){
                    resolve(file.size);
                }));
            }
            else {

                promises.push(new Promise(function(resolve,reject){
                    this.hcs.requestFolderSize(file.path, function (err, size) {
                        if(err){
                            reject(err);
                        }
                        else{
                            resolve(Number(size));
                        }
                    });
                }.bind(this)));
            }
        }.bind(this));
        //Resolving all promises
        Promise.all(promises).then(function(values){
            let filesTotalSize = 0;
            for(let s of values){
                filesTotalSize += s;
            }
            i.sizeLable.innerText = this.prettyBytes(filesTotalSize);
        }.bind(this)
        ,function(err){
            i.sizeLable.innerText = "N.A.";
        });
        i.typeLable.innerText = fileType;
        i.lastModifiedLable.innerText = "Multiple dates";
        
        
        //Set up download button (classIndex == 1 => Directory)
        i.downloadBtn.removeAttribute("disabled");
        i.downloadBtn.onclick = function () {
            var paths = [];
            for(let i=0; i<files.length; i++){
                paths[i] = files[i].path;
            }
            this.hcs.requestMultiFiles(paths);
        }.bind(this);

        //Set up delete button
        i.deleteBtn.onclick = function () {
            let result = confirm(`Are you sure to delete ${files.length} files ?`);
            if (result) {
                let generalError;
                var promises = [];
                //Creating a promises array to delete all files
                files.forEach(function(file){
                    promises.push(new Promise(function(resolve){
                        this.hcs.requestDeleteFile(file.path, function (err) {
                            if(err){
                                generalError = err;
                                resolve(file.name);
                            }
                            else{
                                resolve();
                            }
                        }.bind(this));
                    }.bind(this)));
                }.bind(this));
                Promise.all(promises).then(function(val){
                    if (generalError) {
                        //Filter out all the files that were fully deleted (that will be undefined values in this array)
                        values = value.filter(function(elem){
                            return elem;
                        });
                        var data = {
                            message: `Error deleting ${values.length} out of ${files.length} files`,
                            timeout: 3000
                        };
                        this.notification.MaterialSnackbar.showSnackbar(data);
                        this.multipleSelection.update();
                    }
                    else {

                        var data = {
                            message: `${files.length} files deleted`,
                            timeout: 3000
                        };
                        //Close the dialog and reload the current folder
                        this.infoDialog.close();
                        trs.forEach(function(tr){
                            tr.remove();
                        });
                        this.notification.MaterialSnackbar.showSnackbar(data);
                        this.multipleSelection.update();
                    }
                }.bind(this));
            }
        }.bind(this);

        //Disabling the rename button, no multiple rename
        i.renameBtn.setAttribute("disabled", "disabled");
        i.renameBtn.onclick = undefined;

        
        //Resetting the cut button and then setting it up to cut this element
        i.cutBtn.setAttribute("disabled", "disabled");
        i.cutBtn.onclick = undefined;
        if (canCut) {
            i.cutBtn.removeAttribute("disabled");
            i.cutBtn.onclick = function () {
                files.forEach(function(file){
                    this.clipboardCutDialog.addRow(file.name, file.path);
                }.bind(this));
                
                //Close the dialog
                this.infoDialog.close();
            }.bind(this);
        }

        
        //Resetting the copy button and then setting it up to copy this element
        i.copyBtn.setAttribute("disabled", "disabled");
        i.copyBtn.onclick = undefined;
        if (canCopy) {
            i.copyBtn.removeAttribute("disabled");
            i.copyBtn.onclick = function () {
                files.forEach(function(file){
                    this.clipboardCopyDialog.addRow(file.name, file.path);
                }.bind(this));
                
                //Close the dialog
                this.infoDialog.close();
            }.bind(this);
        }

        
        //First reset to a general state, then activate share buttons if needed
        i.publicShareBtn.setAttribute("disabled", "disabled");
        i.publicShareBtn.onclick = undefined;
        i.linkShareBtn.setAttribute("disabled", "disabled");
        i.linkShareBtn.onclick = undefined;
        /*
        if (canShare == true) {
            //Enable buttons if they have been disabled by previous calls
            i.publicShareBtn.removeAttribute("disabled");
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
                        this.infoDialog.close();
                        this.notification.MaterialSnackbar.showSnackbar(data);
                        //Saving the info in the file manually, no need for another filetree request
                        file.publicShared = true;
                    }
                }.bind(this));
            }.bind(this);

            //If is not a folder (classIndex 1 == Folder)
            if (file.classIndex != 1) {
                i.linkShareBtn.removeAttribute("disabled");
                i.linkShareBtn.onclick = function () {
                    this.hcs.shareFileLink(file.path, function (err, link) {
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
                                message: `${file.name} shared by link - Link in the file info`,
                                timeout: 3000
                            };
                            //Close the dialog
                            this.infoDialog.close();
                            this.notification.MaterialSnackbar.showSnackbar(data);
                            //Saving the info in the file manually, no need for another filetree request
                            file.linkShared = true;
                            file.link = link;
                        }
                    }.bind(this));
                }.bind(this);
            }
            
        }
        */

        i.showModal();
    }

    uploadFile(files) {
        if (!files || files.length < 1) {
            return;
        }
        //Show the progress bar and lock the add button first
        this.bottomProgressBar.style.display = "";
        this.uploadInfoDiv.style.display = "";
        this.addFileBtn.setAttribute("disabled", "true");
        this.isUploadingFile = true;
        //Grab a reference to the files name
        var filesName = files[0].name;
        filesName += (files.length > 1) ? ` + ${files.length - 1} more` : "";
        //And then start uploading the file
        console.log("Started uploding " + filesName);
        this.hcs.uploadFile("./", files,
            function (perc, loadedData, totalData, bps, remainingTime) {
                //Every time a new percentage of uploading is calculated, update the progressbar
                if (perc != 1) {
                    this.bottomProgressBar.MaterialProgress.setProgress(perc * 100);
                    //this.uploadInfoDiv.querySelector("#uploadSpeed").innerText = Math.floor(bps / 1000);
                    this.uploadInfoDiv.querySelector("#uploadSpeed").innerText = this.prettyBytes(bps);
                    this.uploadInfoDiv.querySelector("#uploadSpeedUnit").innerText = "/s";
                    this.uploadInfoDiv.querySelector("#ramainingTime").innerText = Math.ceil(remainingTime);
                    this.uploadInfoDiv.querySelector("#ramainingTimeUnit").innerText = "seconds";
                }
                else {
                    this.bottomProgressBar.classList.add("mdl-progress--indeterminate");
                    this.uploadInfoDiv.querySelector("#uploadSpeed").innerText = 0;
                    this.uploadInfoDiv.querySelector("#uploadSpeedUnit").innerText = "KB/s";
                    this.uploadInfoDiv.querySelector("#ramainingTime").innerText = 0;
                    this.uploadInfoDiv.querySelector("#ramainingTimeUnit").innerText = "seconds";
                }

            }.bind(this),
            function (err, filePath) {
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
                this.uploadInfoDiv.style.display = "none";
                this.bottomProgressBar.classList.remove("mdl-progress--indeterminate");
                //Reload the folder
                this.openFolder(undefined, false);
                //Unlock the addFile button if not in a special folder
                if (!this.inSpecialFolder) this.addFileBtn.removeAttribute("disabled");
                this.isUploadingFile = false;

            }.bind(this)
        );
    }

    addFolder() {
        let i = this.chooseNameDialog;
        i.selectBtn.onclick = function () {
            if (i.newNameInputBar.value.trim() != "") {
                this.hcs.requestCreateFolder("./" + i.newNameInputBar.value, function (err) {
                    if (err) {
                        var data = {
                            message: `Cannot create folder ${i.newNameInputBar.value}: Invalid path`,
                            timeout: 3000
                        };
                        this.notification.MaterialSnackbar.showSnackbar(data);
                    }
                    else {
                        var data = {
                            message: `${i.newNameInputBar.value} created`,
                            timeout: 3000
                        };
                        this.notification.MaterialSnackbar.showSnackbar(data);
                        this.openFolder(undefined, false);
                    }
                    i.close();
                    i.newNameInputBar.blur();
                }.bind(this));
            }
        }.bind(this);

        i.showModal();
        i.newNameInputBar.focus();
    }

    openFile(file) {
        var path = encodeURIComponent(file.path);
        path = "/files?req=file&path=" + path;
        //If the file type is not present, just download it
        if(!file.type){
            document.location = path;
        }
        if (file.type.includes("audio") && window.musicPlayer.audio.canPlayType(file.type) != "") {
            window.musicPlayer.load(path, file.name, file.path);
        }
        else {
            document.location = path;
        }

    }

    toggleDrawer(drawer) {
        if (drawer.classList.contains("is-small-screen")) {
            drawer.MaterialLayout.toggleDrawer();
        }
    }

    createWaitingTableRow() {
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
        iconInfo.innerHTML = "hourglass_full";
        rightIconDiv.appendChild(iconInfo);
        tdInfo.appendChild(rightIconDiv);

        tr.appendChild(tdName);
        tr.appendChild(tdSize);
        tr.appendChild(tdInfo);

        return tr;
    }

    createNotFoundTableRow() {
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

    createErrorTableRow() {
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

    //Function copied from a webtorrent demo - https://webtorrent.io/intro
    prettyBytes(num) {
        var exponent, unit, neg = num < 0, units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        if (neg) num = -num
        if (num < 1) return (neg ? '-' : '') + num + ' B'
        exponent = Math.min(Math.floor(Math.log(num) / Math.log(1000)), units.length - 1)
        num = Number((num / Math.pow(1000, exponent)).toFixed(2))
        unit = units[exponent]
        return (neg ? '-' : '') + num + ' ' + unit
    }
}