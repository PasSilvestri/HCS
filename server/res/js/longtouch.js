window.addEventListener("click", function (e) { alert("click") });
window.addEventListener("longtouch", function (e) { alert("longtouch") });

var longLouchTimers = {};
window.addEventListener("touchstart", function (event) {
    event.preventDefault();
    longLouchTimers[event.changedTouches[0].identifier] = setTimeout(function () {
        var longTouchEvent = new CustomEvent("longtouch", {
            cancelable: true,
            bubbles: true
        });
        longTouchEvent.changedTouches = event.changedTouches;
        longTouchEvent.targetTouches = event.targetTouches;
        longTouchEvent.touches = event.touches;
        event.target.dispatchEvent(longTouchEvent);
        longLouchTimers[event.changedTouches[0].identifier] = "done";
    }, 500);
});
window.addEventListener("touchend", function (event) {
    if(longLouchTimers[event.changedTouches[0].identifier] != "done"){
        clearTimeout(longLouchTimers[event.changedTouches[0].identifier]);
        //If the long touch wasn't done, dispatch a click event
        var newClick = document.createEvent("MouseEvents");
        newClick.PAS = true;
        let touch = event.changedTouches[0];
        newClick.initMouseEvent("click", true, true, window, 0,
        	touch.screenX, touch.screenY, touch.clientX, touch.clientY,
        	event.ctrlKey, event.altKey, event.shiftKey, event.metaKey, 0, null);
        event.target.dispatchEvent(newClick);
    }
    delete longLouchTimers[event.changedTouches[0].identifier];

});
window.addEventListener("touchcancel", function (event) {
    clearTimeout(longLouchTimers[event.changedTouches[0].identifier]);
    delete longLouchTimers[event.changedTouches[0].identifier];
});
window.addEventListener("touchmove", function (event) {
    clearTimeout(longLouchTimers[event.changedTouches[0].identifier]);
    delete longLouchTimers[event.changedTouches[0].identifier];
});