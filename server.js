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
  , debug = false

app.use(logger('dev'))
app.use(express.static(__dirname + '/static'))
app.use(bodyParser.urlencoded({
    extended: true
}))
app.use(bodyParser.json())

app.get('/v/q:quality/:hash_url', (req, res, next) => {
    try {
        hash = req.params.hash_url.split(".mp4")[0]
        var torrent = torrentClient.get(hash)
        if (torrent == null) {
            res.status(404).send('Error')
            return
        }
        var correctFile = torrent.files[0]
        var audioBitRate = 128

        if (debug) console.log("View url (hash: " + hash + ")")

        for (var i = torrent.files.length - 1; i >= 0; i--) {
            file = torrent.files[i]
            if (file.length > correctFile.length) {
                correctFile = file
                correctFile.length = file.length
            }
        }
        if (debug) console.log("File: " + (correctFile ? correctFile.name : correctFile))

        var quality = req.params.quality
        if (debug) console.log("Quality: " + quality)

        if (quality == 'ORG' || parseInt(quality) == 2000) {
            if (debug) console.log("Size: " + correctFile.length.toString())
            res.writeHead(200, {
                'Content-Type': 'video/*',
                'Content-Length': correctFile.length.toString()
            })
            correctFile.createReadStream().pipe(res)
        } else if (parseInt(quality)) {
            transcoder = new Transcoder(correctFile.createReadStream())
                .videoCodec('libx264')
                .videoBitrate(parseInt(quality) * 1000)
                .audioCodec('aac')
                .audioBitrate(audioBitRate * 1000)
                .channels(2)
                .format('mp4')
                .on('finish', () => {
                    next()
                })
                .on('error', error => {if (debug) console.log(error)})
            t_stream = transcoder.stream()

            transcoder.on('metadata', info => {
                if (debug) console.log(info.input.duration)
                res.writeHead(200, {
                    'Content-Type': 'video/*',
                    'Content-Length': info.input.duration * (audioBitRate + parseInt(quality) / 1000)
                })
                t_stream.pipe(res)
            })
        } else {
            res.redirect('/')
        }
    } catch (e) {
        if (debug) console.log(e)
        res.redirect('/')
        next(e)
    }
})

app.get('/', (req, res, next) => {
    try {
        var html = pug.renderFile(__dirname + '/source/views/upload.pug')
        res.send(html)
    } catch (e) {
        res.redirect('/')
        next(e)
    }
})

app.post('/upload', upload.single('torrent'), (req, res, next) => {
    try {
        if (undefined !== req.body.magnet && req.body.magnet !== '') {
            magnet_torrent = req.body.magnet
            name = magnet_torrent
            if (debug) console.log("Magnet taken")
        } else if (undefined !== req.file) {
            magnet_torrent = req.file.buffer
            name = req.file.originalname
            if (debug) console.log("Torrent file taken")
        } else {
            if (debug) console.log("Torrent/magen adquisition error")
            res.redirect('/')
            return
        }

        torrentClient.add(magnet_torrent, { path: __dirname + '/downloads/' + md5(name) }, torrent => {
            torrent.on('error', error => {
                if (debug) console.log("Torrent error")
                if (debug) console.log(error)
            })
            if (debug) console.log("Torrent added")
            if (debug) console.log("Download path: " + torrent.path)
            addr = '/v/q' + req.body.quality + '/' + torrent.infoHash + '.mp4'
            if (debug) console.log("Redirect: " + addr)
            res.redirect(addr)
        })

        torrentClient.on('error', error => {
            if (res._headerSent) {
                return
            }
            if (error.toString().indexOf("duplicate") < 0) {
                if (debug) console.log("Torrent client error")
                if (debug) console.log(error)
                addr = '/'
                if (debug) console.log("Redirect (on error): " + addr)
            } else {
                if (debug) console.log("Duplicate torrent")
                addr = '/v/q' + req.body.quality + '/' + error.toString().split(" ").pop() + '.mp4'
                if (debug) console.log("Redirect: " + addr)
            }
            res.redirect(addr)
        })
    } catch (e) {
        res.redirect('/')
        next(e)
    }
})

app.listen(process.env.PORT || 3000, () => {
    if (debug) console.log('Serving')
})