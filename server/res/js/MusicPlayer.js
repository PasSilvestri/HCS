class MusicPlayer {

    constructor(){
        this.audio = document.getElementById("audioPlayer");
        this.audio.volume = 1;

        this.controlsContainer = document.getElementById("musicPlayerDiv");
        this.progressBar = document.querySelector("#musicPlayerDiv #musicProgressBar");
        this.playPauseBtn = document.querySelector("#musicPlayerDiv #playPauseBtn");
        this.playBtnIcon = document.querySelector("#musicPlayerDiv #playPauseBtn .material-icons");
        this.slider = document.querySelector("#musicPlayerDiv .music-slider");
        this.totalTimeSpan = document.querySelector("#musicPlayerDiv #musicTotalTime");
        this.timeSpan = document.querySelector("#musicPlayerDiv #musicTime");
        this.audioNameSpan = document.querySelector("#musicPlayerDiv #musicName");

        //Setting up play-pause button
        this.playPauseBtn.onclick = function(event){
            this.togglePlayPause();
        }.bind(this);

        //Setting up the slider

        //onInput called when slider is being dragged
        this.slider.oninput = function(event){
            this.draggingSlider = true;
            //this.audio.currentTime = (this.slider.value/100)*this.audio.duration;
        }.bind(this);
        //onChange called when slider is dropped
        this.slider.onchange = function(event){
            this.draggingSlider = false;
            this.audio.currentTime = (this.slider.value/100)*this.audio.duration;
        }.bind(this);
        //Click on the bar should instantlly change the current time
        $("#musicPlayerDiv .music-slider").click = function(event){
            let posX = event.pageX - $(this).offset().left;
            let max = $(this).offset().right - $(this).offset().left;
            let val = (posX*100)/max;
            this.slider.value = val;
            //this.audio.currentTime = (val/100)*this.audio.duration;
        }

        //Called when there is enough buffered to start playing
        this.audio.addEventListener("canplaythrough", function(){
            console.log("canplaythrough");
            this.autoplay = true;
            this.playBtnIcon.parentElement.classList.remove("rotate");
            if(this.audio.paused){
                this.playBtnIcon.innerText = "play_arrow";
            }
            else{
                this.playBtnIcon.innerText = "pause";
            }
        }.bind(this));

        this.audio.addEventListener("canplay", function(){
            console.log("canplay");
            //Change button icon only if song autoplayed already, otherwise, wait for it to autoplay
            if(this.autoplay){
                this.playBtnIcon.parentElement.classList.remove("rotate");
                if(this.audio.paused){
                    this.playBtnIcon.innerText = "play_arrow";
                }
                else{
                    this.playBtnIcon.innerText = "pause";
                }
            }
            
        }.bind(this));

        //Called when the player is buffering
        this.audio.addEventListener("waiting",this.setLoadingState.bind(this));

        //Called when metadata with duration, name, etc info has been loaded
        this.audio.addEventListener("loadedmetadata",this.updateMetadata.bind(this));

        //Called when more has been buffered
        this.audio.addEventListener("progress",this.updateBuffer.bind(this));

        //Called when the current time has changed
        this.audio.addEventListener("timeupdate",this.updateTime.bind(this));

        //Called when audio is starting to play
        this.audio.addEventListener("play",this.playEvent.bind(this));

        //Called when audio is being paused
        this.audio.addEventListener("pause",this.pauseEvent.bind(this));

        //Called an error occurs when loading audio
        this.audio.addEventListener("error",this.errorEvent.bind(this));

        //Called when loading audio is aborted
        this.audio.addEventListener("abort",this.errorEvent.bind(this));

        //Called when the browser is trying to get media data, but data is not available
        this.audio.addEventListener("stalled",this.errorEvent.bind(this));

        //Called when the browser is intentionally not getting media data
        this.audio.addEventListener("suspended",this.errorEvent.bind(this));

    }

    load(src,name = "Unknown",hcsPath){
        this.buffered = 0;
        this.currentSrc = src;
        this.audio.src = src;

        this.currentName = name;
        this.audioNameSpan.innerText = name;

        this.controlsContainer.style.visibility = "visible";

        this.progressBar.MaterialProgress.setProgress(0);
        this.slider.value = 0;
        this.progressBar.MaterialProgress.setBuffer(0);

        this.setLoadingState();
        //If true a canplaythrough was called at least once, so the song automatically started playing
        this.autoplay = false
        
        //Android play/pause notification
        if ('mediaSession' in navigator) {
            let album = hcsPath.substring(0,hcsPath.lastIndexOf("/"));
            navigator.mediaSession.metadata = new MediaMetadata({
                title: name,
                artist: 'HCS',
                album: album
            });
        }
              

        this.audio.load();
    }

    errorEvent(){
        console.log("error");
        this.audioNameSpan.innerText = "Error loading the audio";

        this.progressBar.MaterialProgress.setProgress(0);
        this.slider.value = 0;
        this.progressBar.MaterialProgress.setBuffer(0);

        this.playBtnIcon.parentElement.classList.remove("rotate");
        this.playBtnIcon.innerText = "play_arrow";

        this.totalTimeSpan.innerText = this.getTimeString(0);
        this.timeSpan.innerText = this.getTimeString(0);

        let a = document.createElement("a");
        a.setAttribute("href", this.currentSrc);
        a.setAttribute("download", this.currentName);
        a.click();

        this.pause();
        this.stopTimeCount();
    }

    togglePlayPause(){
        if(this.audio.paused){ 
            this.play();
        }
        else{
            this.pause();
        }
    }

    play(){
        this.audio.play();
    }

    playEvent(){
        console.log("play");
        this.playBtnIcon.innerText = "pause";
        this.startTimeCount(500);
    }

    pause(){
        this.audio.pause();
    }

    pauseEvent(){
        console.log("pause");
        this.playBtnIcon.innerText = "play_arrow";
        this.stopTimeCount();
    }

    setLoadingState(){
        console.log("waiting");
        this.playBtnIcon.innerText = "hourglass_full"
        this.playBtnIcon.parentElement.classList.add("rotate");
    }

    updateTime(){
        if(this.audio.readyState >= 1){          
            this.timeSpan.innerText = this.getTimeString(this.audio.currentTime);
            let time = (this.audio.currentTime*100)/this.audio.duration;
            this.progressBar.MaterialProgress.setProgress(time);
            //draggingSlider is true if the slider is being draged
            if(!this.draggingSlider){
                this.slider.value = time;
            }
            
        }
    }

    startTimeCount(step){
        if(this.timeCountTimer) clearTimeout(this.timeCountTimer);
        this.timeCountTimer = setTimeout(this.startTimeCount.bind(this),step,step);
        this.updateTime();
    }

    stopTimeCount(){
        if(this.timeCountTimer) clearTimeout(this.timeCountTimer);
    }

    updateBuffer(){
        if(this.audio.readyState >= 1 && this.audio.buffered.length > 0){
            let buf = this.audio.buffered.end(0) - this.audio.buffered.start(0);
            buf = (buf*100)/this.audio.duration;
            this.progressBar.MaterialProgress.setBuffer(buf);
            this.buffered = buf;
        }
    }

    updateMetadata(){
        this.totalTimeSpan.innerText = this.getTimeString(this.audio.duration);
        this.timeSpan.innerText = this.getTimeString(this.audio.currentTime);
        this.updateBuffer();
    }

    getTimeString(time){
        let minutes = Math.floor(time/60);
        //Pas remember that x%60 returns a number between 0 and 59, without the additional loopback to 60
        let seconds = Math.floor(time%60);

        if(minutes<10){
            minutes = "0" + minutes.toString();
        }
        else{
            minutes = minutes.toString();
        }

        if(seconds<10){
            seconds = "0" + seconds.toString();
        }
        else{
            seconds = seconds.toString();
        }

        return minutes + ":" + seconds;
    }

}