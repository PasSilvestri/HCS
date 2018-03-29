window.addEventListener("touchstart",()=>{
    window.hasTouchScreen = true;
})
window.addEventListener("contextmenu",(e)=>{
    if (window.hasTouchScreen) {
        e.preventDefault();
        var longTouchEvent = new CustomEvent("longtouch", {
            cancelable: true,
            bubbles: true
        });
        for (let p in e) {
            if (p == "type") continue;
            longTouchEvent[p] = e[p];
        }
        e.target.dispatchEvent(longTouchEvent);
        window.hasTouchScreen = false;
    }
});