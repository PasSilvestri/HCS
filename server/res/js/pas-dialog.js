(function () {
    window.addEventListener("load", function () {
        let dialogs = document.querySelectorAll(".pas-dialog");
        dialogs.forEach(function (elem) {

            //Setting up events holders
            elem.events = {}
            elem.events.show = [];
            elem.events.showmodal = [];
            elem.events.close = [];

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

                //Calling the registered callbacks
                this.events.show.forEach(function(callback){
                    let event = {
                        type: "show",
                        target: this
                    }
                    callback(event);
                }.bind(this));

            }.bind(elem);

            elem.showModal = function () {
                this.attributes["data-dialog-status"].value = "openModal";

                //Calling the registered callbacks
                this.events.showmodal.forEach(function(callback){
                    let event = {
                        type: "showmodal",
                        target: this
                    }
                    callback(event);
                }.bind(this));

            }.bind(elem);

            elem.close = function () {
                this.attributes["data-dialog-status"].value = "close";
                
                //Calling the registered callbacks
                this.events.close.forEach(function(callback){
                    let event = {
                        type: "close",
                        target: this
                    }
                    callback(event);
                }.bind(this));

            }.bind(elem);

            let backdrop = elem.querySelector(".pas-dialog__backdrop");
            backdrop.addEventListener("click", elem.close);

            /**
             * Register a callback when an event is fired
             * @param {String} event - The event requested. Can be: "show", "showmodal", "close"
             * @param {Function} callback - The function that gets called
             */
            elem.addEventListener = function(event,callback){
                if(typeof event != "string" || (event != "show" && event != "showmodal" && event != "close")){
                    throw new Error("Event type not supported");
                }
                if(typeof callback != "function"){
                    throw new Error("Callback must be a function");
                }
                elem.events[event].push(callback);
            }

            /**
             * removes a callback from the list of callbacks called whe an event is fired
             * @param {String} event - The event requested. Can be: "show", "showmodal", "close"
             * @param {Function} callback - The function that gets removed
             */
            elem.removeEventListener = function(event,callback){
                if(typeof event != "string" || (event != "show" && event != "showmodal" && event != "close")){
                    throw new Error("Event type not supported");
                }
                if(typeof callback != "function"){
                    throw new Error("Callback must be a function");
                }
                let i = elem.events[event].indexOf(callback);
                if(i != -1){
                    elem.events[event].splice(i,1);
                }
            }


        });
    });
})();