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

app.get('/v/q:quality/:hash_url', function (req, res, next) {
    try {
        hash = req.params.hash_url.split(".mp4")[0]
        var torrent = torrentClient.get(hash)
        var maxLength = 0
        var correctFile = null
        var audioBitRate = 128

        for (var i = torrent.files.length - 1; i >= 0; i--) {
            file = torrent.files[i]
            if (file.length > maxLength) {
                correctFile = file
                maxLength = file.length
            }
        }

        stream = correctFile.createReadStream()

        out = new Transcoder(stream)
            .videoCodec('libx264')
            .videoBitrate(req.params.quality * 1000)
            .audioCodec('aac')
            .audioBitrate(audioBitRate * 1000)
            .format('mp4')
            .on('finish', function() {
                next();
            })

        out.on('metadata', function(info) {
            var size = info.input.duration * (parseInt(req.params.quality) + audioBitRate) / 8

            // if (!req.headers.range) {
                res.writeHead(200, {
                    'Content-Type': 'video/*',
                    // 'Content-Range': 'bytes 0-' + (size-1).toString() + '/' + size.toString(),
                    // 'Accept-Ranges': 'bytes',
                    'Content-Length': size.toString()
                })
            // } else {
            //     var positions = req.headers.range.replace(/bytes=/, "").split("-")
            //     var start = parseInt(positions[0], 10)
            //     var dif = (size - start) + 1;

            //     res.writeHead(200, {
            //         'Content-Type': 'video/*',
            //         'Content-Range': 'bytes ' + start.toString() + '-' + (size-1).toString() + '/' + size.toString(),
            //         'Accept-Ranges': 'bytes',
            //         'Content-Length': dif.toString()
            //     })
            // }
        })

        out.stream().pipe(res)
    } catch (e) {
        console.log(e)
        res.redirect('/')
        next(e)
    }
})

app.get('/', function (req, res, next) {
    try {
        var html = jade.renderFile(__dirname + '/source/views/upload.jade')
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
        } else if (undefined !== req.file) {
            magnet_torrent = req.file.buffer
            name = req.file.originalname
        } else {
            res.redirect('/')
            return
        }

        torrentClient.add(magnet_torrent, { path: __dirname + '/downloads/' + name }, function (torrent) {
            res.redirect('/v/q' + req.body.quality + '/' + torrent.infoHash + '.mp4')
        })

        torrentClient.on('error', function (error) {
            res.redirect('/v/q' + req.body.quality + '/' + error.toString().split(" ").pop() + '.mp4')
        })
    } catch (e) {
        res.redirect('/')
        next(e)
    }
})

app.listen(process.env.PORT || 3000, function () {
    console.log('Listening on http://localhost:' + (process.env.PORT || 3000))
})