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

        console.log("View url (hash: " + hash + ")")

        for (var i = torrent.files.length - 1; i >= 0; i--) {
            file = torrent.files[i]
            if (file.length > correctFile.length) {
                correctFile = file
                correctFile.length = file.length
            }
        }
        console.log("File: " + (correctFile ? correctFile.name : correctFile))

        var quality = req.params.quality
        console.log("Quality: " + quality)

        if (quality == 'ORG') {
            console.log("Size: " + correctFile.length.toString())
            res.writeHead(200, {
                'Content-Type': 'video/*',
                'Content-Length': correctFile.length.toString()
            })
            correctFile.createReadStream().pipe(res)
        } else if (parseInt(quality)) {
            res.writeHead(200, {
                'Content-Type': 'video/*'
            })
            new Transcoder(correctFile.createReadStream())
                .videoCodec('libx264')
                .videoBitrate(parseInt(quality) * 1000)
                .audioCodec('aac')
                .audioBitrate(audioBitRate * 1000)
                .format('mp4')
                .on('finish', () => {
                    next()
                })
                .on('error', error => {console.log(error)})
                .stream().pipe(res)
        } else {
            res.redirect('/')
        }
    } catch (e) {
        console.log(e)
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

        torrentClient.add(magnet_torrent, { path: __dirname + '/downloads/' + md5(name) }, torrent => {
            torrent.on('error', error => {
                console.log("Torrent error")
                console.log(error)
            })
            console.log("Torrent added")
            console.log("Download path: " + torrent.path)
            addr = '/v/q' + req.body.quality + '/' + torrent.infoHash + '.mp4'
            console.log("Redirect: " + addr)
            res.redirect(addr)
        })

        torrentClient.on('error', error => {
            if (res._headerSent) {
                return
            }
            if (error.toString().indexOf("duplicate") < 0) {
                console.log("Torrent client error")
                console.log(error)
                addr = '/'
                console.log("Redirect (on error): " + addr)
            } else {
                console.log("Duplicate torrent")
                addr = '/v/q' + req.body.quality + '/' + error.toString().split(" ").pop() + '.mp4'
                console.log("Redirect: " + addr)
            }
            res.redirect(addr)
        })
    } catch (e) {
        res.redirect('/')
        next(e)
    }
})

app.listen(process.env.PORT || 80, () => {
    console.log('Serving')
})