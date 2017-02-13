var express = require('express')
  , logger = require('morgan')
  , jade = require('jade')
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

app.get('/', function (req, res, next) {
    try {
        var html = jade.renderFile(__dirname + '/source/views/homepage.jade')
        res.send(html)
    } catch (e) {
        next(e)
    }
})

app.get('/upload', function (req, res, next) {
    try {
        var html = jade.renderFile(__dirname + '/source/views/upload.jade')
        res.send(html)
    } catch (e) {
        next(e)
    }
})

app.post('/upload', upload.single('torrent'), function (req, res, next) {
    try {
        if (undefined !== req.body.magnet) {
            magnet_torrent = req.body.magnet
            name = magnet_torrent
        } else if (undefined !== req.file) {
            magnet_torrent = req.file.buffer
            name = req.file.originalname
        }
        torrentClient.add(magnet_torrent, { path: __dirname + '/downloads/' + name }, function (torrent) {
            var maxLength = 0
            var correctFile = null
            var torrentHash = torrent.infoHash
            for (var i = torrent.files.length - 1; i >= 0; i--) {
                file = torrent.files[i]
                if (file.length > maxLength) {
                    correctFile = file
                    maxLength = file.length
                }
            }

            stream = correctFile.createReadStream()

            new Transcoder(stream)
                .videoCodec('libx264')
                .videoBitrate(req.body.quality * 1000)
                .audioCodec('aac')
                .audioBitrate(128 * 1000)
                .format('mp4')
                .on('finish', function() {
                    next();
                })
                .on('error', function() {
                    res.send("Error processing video")
                })
                .on('metadata', function(info) {
                    res.writeHead(200, {
                        'Content-Disposition': 'inline; filename="' + torrentHash + '.mp4"',
                        'Content-Type': 'video/*',
                        'Content-Length': info.input.duration * req.body.quality / 8
                    })
                })
                .stream().pipe(res)
        })

        torrentClient.on('error', function (error) {
            error_string = error.toString()
            if (error_string.indexOf("duplicate")!=-1) {
                var torrentHash = error_string.split(" ").pop()
                torrent = torrentClient.get(torrentHash)

                var maxLength = 0
                var correctFile = null
                for (var i = torrent.files.length - 1; i >= 0; i--) {
                    file = torrent.files[i]
                    if (file.length > maxLength) {
                        correctFile = file
                        maxLength = file.length
                    }
                }

                stream = correctFile.createReadStream()

                new Transcoder(stream)
                    .videoCodec('libx264')
                    .videoBitrate(req.body.quality * 1000)
                    .audioCodec('aac')
                    .audioBitrate(128 * 1000)
                    .format('mp4')
                    .on('finish', function() {
                        next();
                    })
                    .on('error', function() {
                        res.send("Error processing video")
                    })
                    .on('metadata', function(info) {
                        res.writeHead(200, {
                            'Content-Disposition': 'inline; filename="' + torrentHash + '.mp4"',
                            'Content-Type': 'video/*',
                            'Content-Length': info.input.duration * req.body.quality / 8
                        })
                    })
                    .stream().pipe(res)
            }
        })
    } catch (e) {
        console.log(e)
        next(e)
    }
})

app.listen(process.env.PORT || 3000, function () {
    console.log('Listening on http://localhost:' + (process.env.PORT || 3000))
})