var WebTorrent = require('webtorrent')

var client = new WebTorrent();

class HcsTorrent {

    constructor(data, progressCallback, doneCallback, destroyCallback) {

        this.status = 0;

        if (!data || !data.torrentURI) {
            throw "Torrent data object with a valid torrent URI required";
        }

        var torrentURI = data.torrentURI;
        var savePath = data.path;
        var seedingTime = data.seedingTime || 4;

        client.add(torrentURI, { path: savePath }, function (torrent) {
            // Got torrent metadata!
            console.log('Client is downloading:', torrent.infoHash);
            this.status = 1;


            torrent.on('download', function (bytes) {
                if (typeof progressCallback === "function") {
                    let progressObj = {
                        progress: torrent.progress,
                        bytesDownloaded: torrent.downloaded,
                        bytesJustDownloaded: bytes,
                        downloadSpeed: torrent.downloadSpeed,
                        timeRemaining: torrent.timeRemaining,
                        uploadSpeed: torrent.uploadSpeed
                    }
                    progressCallback(progressObj);
                }
            });

            torrent.on("done", function () {
                this.status = 2;
                setTimeout(function () {
                    torrent.destroy(destroyCallback);
                }, seedingTime * 60 * 60 * 1000);
                if (typeof doneCallback === "function")
                    doneCallback(undefined, torrent.path, torrent.files, torrent);
            });

            torrent.on('error', function (err) {
                this.status = -1;
                if (typeof doneCallback === "function")
                    doneCallback(err, torrent.path, torrent.files, torrent);
            });

        });

    }

}

module.exports = HcsTorrent;

var globTor;
var t = new HcsTorrent({ path: `C:\Users\Pasquale\Desktop\test115`, seedingTime: 0, torrentURI: `magnet:?xt=urn:btih:6fd4ebbcbd3869223589c58bc45a900881524d68&amp;dn=Supergirl.S03E11.HDTV.x264-SVA%5Brartv%5D&amp;tr=http%3A%2F%2Ftracker.trackerfix.com%3A80%2Fannounce&amp;tr=udp%3A%2F%2F9.rarbg.me%3A2710&amp;tr=udp%3A%2F%2F9.rarbg.to%3A2710` },
    function (prog) {
        console.log("Progress: " + prog.progress);
    },
    function (err, savedPath, files, torrent) {
        if (err) {
            console.log(err);
        }
        else {
            console.log("Saved at: " + savePath);
            globTor = torrent;
        }
    },
    function () {
        console.log(globTor);
    });

