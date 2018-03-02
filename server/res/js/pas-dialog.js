(function () {
    window.addEventListener("load", function () {
        let dialogs = document.querySelectorAll(".pas-dialog");
        dialogs.forEach(function (elem) {
            Object.defineProperty(elem,"open",{
                enumerable: true,
                get: function(){
                    let status = this.attributes["data-dialog-status"].value
                    return (status == "open" || status == "openModal") ? true : false;
                },
                set: function(value){
                    if(value == true){
                        this.attributes["data-dialog-status"].value = "openModal";
                    }
                    else{
                        this.attributes["data-dialog-status"].value = "close";
                    }
                }
            });

            elem.show = function () {
                this.attributes["data-dialog-status"].value = "open";
            }.bind(elem);

            elem.showModal = function () {
                this.attributes["data-dialog-status"].value = "openModal";
            }.bind(elem);

            elem.close = function () {
                this.attributes["data-dialog-status"].value = "close";
            }.bind(elem);

            let backdrop = elem.querySelector(".pas-dialog__backdrop");
            backdrop.addEventListener("click", elem.close);
        });
    });
})();