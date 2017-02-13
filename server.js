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
            for (var i = torrent.files.length - 1; i >= 0; i--) {
                file = torrent.files[i]
                if (file.length > maxLength) {
                    correctFile = file
                    maxLength = file.length
                }
            }
            stream = correctFile.createReadStream()

            res.writeHead(200, {
                'Content-Type': 'video/*'
            })

            new Transcoder(stream)
                .maxSize(320, 240)
                .videoCodec('mpeg4')
                .videoBitrate(800 * 1000)
                .fps(25)
                .audioCodec('libvorbis')
                .sampleRate(44100)
                .channels(2)
                .audioBitrate(128 * 1000)
                .format('mp4')
                .on('finish', function() {
                    next();
                })
                .stream().pipe(res)
        })
    } catch (e) {
        console.log(e)
        next(e)
    }
})

app.listen(process.env.PORT || 3000, function () {
    console.log('Listening on http://localhost:' + (process.env.PORT || 3000))
})