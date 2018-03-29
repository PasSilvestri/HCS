var WebTorrent = require('webtorrent');

class HcsTorrent {

    /**
     * Download the specified torrent to the specified location
     * @param {Object} data - An object holding dwonalod infos
     * @param {String} data.torrentURI - The torrent file url/magnet url/torrent hash to download
     * @param {String} data.path - Where to store the torrent
     * @param {Number} data.seedingTime - seeding time in hours 
     * @param {Function} doneCallback - Function called when the download is complete or there is an error
     * @param {Function} progressCallback - Function called periodically with some progress infos
     * @param {Function} destroyCallback - Function called when finished seeding the torrent
     */
    constructor(data, doneCallback, progressCallback, destroyCallback) {

        this.client = new WebTorrent();
        this.status = 0;

        if (!data || !data.torrentURI) {
            throw new Error("Torrent data object with a valid torrent URI required");
        }
        if(!doneCallback || (typeof doneCallback != "function")){
            throw new Error("doneCallback function required");
        }

        this.client.on("error",(err) => {
            doneCallback(err);
        });

        var torrentURI = data.torrentURI;
        var savePath = data.path;
        var seedingTime = data.seedingTime || 4;

        this.client.add(torrentURI, { path: savePath }, function (torrent) {
            // Got torrent metadata!
            console.log('this.client is downloading:', torrent.infoHash);
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

