(function () {
    window.addEventListener("load", function () {
        let dialogs = document.querySelectorAll(".pas-dialog");
        dialogs.forEach(function (elem) {

            elem.PasDialog = {
                open: function () {
                    this.attributes["data-dialog-status"].value = "open";
                }.bind(elem),
                close: function () {
                    this.attributes["data-dialog-status"].value = "close";
                }.bind(elem)
            }

            let backdrop = elem.querySelector(".pas-dialog__backdrop");
            backdrop.addEventListener("click", elem.PasDialog.close);
        });
    });
})();