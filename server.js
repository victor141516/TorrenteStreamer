var express = require('express')
  , md5 = require('md5')
  , logger = require('morgan')
  , pug = require('pug')
  , app = express()
  , bodyParser = require('body-parser')
  , multer  = require('multer')
  , storage = multer.memoryStorage()
  , upload = multer({ storage: storage })
  , torrentClient = new (require('webtorrent'))
  , Transcoder = require('stream-transcoder')

app.use(logger('dev'))
app.use(express.static(__dirname + '/static'))
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.get('/v/q:quality/:hash_url', function (req, res, next) {
    try {
        hash = req.params.hash_url.split(".mp4")[0]
        var torrent = torrentClient.get(hash)
        var maxLength = 0
        var correctFile = null
        var audioBitRate = 128

        console.log("View url (hash: " + hash + ")")

        for (var i = torrent.files.length - 1; i >= 0; i--) {
            file = torrent.files[i]
            if (file.length > maxLength) {
                correctFile = file
                maxLength = file.length
            }
        }
        console.log("File: " + (correctFile ? correctFile.name : correctFile))

        var quality = req.params.quality

        if (quality == 'ORG') {
            console.log("Quality: ORIGINAL")
            console.log("Size: " + maxLength.toString())
            res.writeHead(200, {
                'Content-Type': 'video/*',
                'Content-Length': maxLength
            })
            correctFile.createReadStream().pipe(res)
        } else if (parseInt(quality)) {
            console.log("Quality: " + quality)

            // new Transcoder(correctFile.createReadStream())
            //     .custom()
            //     .on('error', function(error) {console.log(error)})
            //     .on('metadata', function(info) {
            //         var size = info.input.duration * (parseInt(quality) + audioBitRate) / 8
            //         console.log("Calculated transcoded size: " + size.toString())
            //         // if (!req.headers.range) {
            //         //     res.writeHead(200, {
            //         //         'Content-Type': 'video/*',
            //         //         // 'Content-Range': 'bytes 0-' + (size-1).toString() + '/' + size.toString(),
            //         //         // 'Accept-Ranges': 'bytes',
            //         //         'Content-Length': size.toString()
            //         //     })
            //         // } else  {
            //         //     start = parseInt(req.headers.range.replace(/bytes=/, "").split("-")[0], 10)
            //             res.writeHead(200, {
            //                 'Content-Type': 'video/*',
            //                 //'Content-Range': 'bytes ' + start.toString() + '-' + (size-1).toString() + '/' + size.toString(),
            //                 //'Accept-Ranges': 'bytes',
            //                 // 'Content-Length': ((size - start) + 1).toString()
            //                 'Content-Length': size.toString()
            //             })

                        new Transcoder(correctFile.createReadStream())
                            .videoCodec('libx264')
                            .videoBitrate(parseInt(quality) * 1000)
                            .audioCodec('aac')
                            .audioBitrate(audioBitRate * 1000)
                            .format('mp4')
                            .on('finish', function() {
                                next();
                            })
                            .on('error', function(error) {console.log(error)})
                            .stream().pipe(res)
                    // }
                // }).exec()
        } else {
            res.redirect('/')
        }
    } catch (e) {
        console.log(e)
        res.redirect('/')
        next(e)
    }
})

app.get('/', function (req, res, next) {
    try {
        var html = pug.renderFile(__dirname + '/source/views/upload.pug')
        res.send(html)
    } catch (e) {
        res.redirect('/')
        next(e)
    }
})

app.post('/upload', upload.single('torrent'), function (req, res, next) {
    try {
        if (undefined !== req.body.magnet && req.body.magnet !== '') {
            magnet_torrent = req.body.magnet
            name = magnet_torrent
            console.log("Magnet taken")
        } else if (undefined !== req.file) {
            magnet_torrent = req.file.buffer
            name = req.file.originalname
            console.log("Torrent file taken")
        } else {
            console.log("Torrent/magen adquisition error")
            res.redirect('/')
            return
        }

        torrentClient.add(magnet_torrent, { path: __dirname + '/downloads/' + md5(name) }, function (torrent) {
            console.log("Torrent added")
            console.log("Download path: " + torrent.path)
            res.redirect('/v/q' + req.body.quality + '/' + torrent.infoHash + '.mp4')
        })

        torrentClient.on('error', function (error) {
            console.log("Torrent client error")
            console.log(error)
            res.redirect('/')
        })
    } catch (e) {
        res.redirect('/')
        next(e)
    }
})

app.listen(process.env.PORT || 3000, function () {
    console.log('Listening on http://localhost:' + (process.env.PORT || 3000))
})