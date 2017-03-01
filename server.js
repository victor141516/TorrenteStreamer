var express = require('express')
  , md5 = require('md5')
  , logger = require('morgan')
  , pug = require('pug')
  , app = express()
  , bodyParser = require('body-parser')
  , multer  = require('multer')
  , storage = multer.memoryStorage()
  , upload = multer({ storage: storage })
  , WebTorrent = new (require('webtorrent'))
  , Transcoder = require('stream-transcoder')
  , Promise = require('promise')
  , debug = true
  , bitrateRange = {'min': 400, 'max': 2000, 'default': 2000}
  , maxDownloadCache = 1000000000
  , servingPort = 3000

app.use(logger('dev'))
app.use(express.static(__dirname + '/static'))
app.use(bodyParser.urlencoded({
    extended: true
}))
app.use(bodyParser.json())


function removeOldTorrents() {
    return new Promise(function(resolve) {
        var allSize = 0
        WebTorrent.torrents.reverse().forEach(function(torrent, index) {
            if (allSize > maxDownloadCache) {
                torrent.destroy()
            } else {
                torrent.files.forEach(function(file) {
                    allSize += file.length
                })
            }
        })
        resolve(allSize)
    })
}

function getBiggestFile(files) {
    correct = files[0]
    for (var i = files.length - 1; i >= 0; i--) {
        file = files[i]
        if (file.length > correct.length) {
            correct = file
        }
    }
    return correct
}

function getTorrentFromRequest(req) {
    if (undefined !== req.body.magnet && req.body.magnet !== '') {
        if (debug) console.log('Debug: ' + 'Magnet taken')
        return {
            'torrent': req.body.magnet,
            'name': req.body.magnet
        }
    } else if (undefined !== req.file) {
        if (debug) console.log('Debug: ' + 'Torrent file taken')
        return {
            'torrent': req.file.buffer,
            'name': req.file.originalname
        }
    } else {
        if (debug) console.log('Debug: ' + 'Torrent/magen adquisition error')
        return null
    }
}

function getStream(file, videoBitrate, audioBitrate, start_end) {
    return new Promise(
        function (resolve, reject) {
            if (videoBitrate == 'ORG') videoBitrate = bitrateRange.max
            if (isNaN(parseInt(videoBitrate))) {
                reject()
            }
            if (videoBitrate > bitrateRange.max) videoBitrate = bitrateRange.max
            if (videoBitrate < 1) videoBitrate = bitrateRange.min
            quality = parseInt(videoBitrate)

            file_stream = file.createReadStream(start_end)
            if (quality == bitrateRange.max) {
                if (debug) console.log('Debug: ' + 'Size: ' + file.length.toString())
                resolve({
                    'httpCode': start_end ? 206 : 200,
                    'size': file.length,
                    'stream': file_stream
                })
            } else {
                transcoder = new Transcoder(file_stream)
                    .videoCodec('libx264')
                    .videoBitrate(quality * 1000)
                    .audioCodec('aac')
                    .audioBitrate(audioBitrate * 1000)
                    .channels(2)
                    .format('mp4')
                transcoded_stream = transcoder.stream()

                transcoder.on('error', error => {
                    if (debug) console.log('Debug: ' + error)
                    reject(error)
                })
                transcoder.on('metadata', info => {
                    if (debug) console.log('Debug: ' + info.input.duration)
                    resolve({
                        'httpCode': 200,
                        'size': info.input.duration * (audioBitrate + quality / 1000),
                        'stream': transcoded_stream
                    })
                })
            }
        })
}

function addTorrent(input_torrent, name) {
    return new Promise(
        function (resolve, reject) {
            WebTorrent.add(input_torrent, { path: __dirname + '/downloads/' + md5(name) }, torrent => {
                torrent.on('error', error => {
                    if (debug) console.log('Debug: ' + 'Torrent error')
                    if (debug) console.log('Debug: ' + error)
                    reject()
                })
                if (debug) console.log('Debug: ' + 'Torrent added')
                resolve(torrent.infoHash)
            })

            WebTorrent.on('error', error => {
                if (error.toString().indexOf('duplicate') < 0) {
                    if (debug) console.log('Debug: ' + 'Torrent client error')
                    if (debug) console.log('Debug: ' + error)
                    reject()
                } else {
                    if (debug) console.log('Debug: ' + 'Duplicate torrent')
                    resolve(error.toString().split(' ').pop())
                }
            })
        }
    )
}

app.get('/v/:hash_url', (req, res, next) => {
    try {
        const compiledFunction = pug.compileFile(__dirname + '/source/views/player.pug')
        var html = compiledFunction({'video_src': '/s/' + req.params.hash_url})
        res.send(html)
    } catch (e) {
        if (debug) console.log('Debug: ' + e)
        res.redirect('/d/q' + req.params.quality + '/' + req.params.hash_url)
        next(e)
    }
})

app.get('/d/q:quality/:hash_url', (req, res, next) => {
    try {
        var torrent = WebTorrent.get(req.params.hash_url.split('.mp4')[0])
          , correctFile = getBiggestFile(torrent.files)
          , quality = req.params.quality

        if (debug) console.log('Debug: ' + 'View url (hash: ' + (req.params.hash_url.split('.mp4')[0]) + ')')
        if (debug) console.log('Debug: ' + 'File: ' + (correctFile ? correctFile.name : correctFile))
        if (debug) console.log('Debug: ' + 'Quality: ' + quality)

        getStream(correctFile, quality, 128)
            .then(result => {
                res.writeHead(result.httpCode, {
                    'Content-Type': 'video/*',
                    'Content-Length': result.size
                })
                result.stream.pipe(res)
            })
            .catch(error => {
                console.log(error)
                res.redirect('/')
            })
    } catch (e) {
        if (debug) console.log('Debug: ' + e)
        res.redirect('/')
        next(e)
    }
})

app.get('/s/:hash_url', (req, res, next) => {
    try {
        var torrent = WebTorrent.get(req.params.hash_url.split('.mp4')[0])
          , correctFile = getBiggestFile(torrent.files)

        if (debug) console.log('Debug: ' + 'View url (hash: ' + (req.params.hash_url.split('.mp4')[0]) + ')')
        if (debug) console.log('Debug: ' + 'File: ' + (correctFile ? correctFile.name : correctFile))

        getStream(correctFile, bitrateRange.max, 128)
            .then(result => {
                var range = req.headers.range;
                var positions = range.replace(/bytes=/, "").split("-");
                var start = parseInt(positions[0], 10);
                var total = result.size;
                var end = positions[1] ? parseInt(positions[1], 10) : total - 1;
                var chunksize = (end - start) + 1;

                res.writeHead(result.httpCode, {
                    "Content-Range": "bytes " + start + "-" + end + "/" + total,
                    "Accept-Ranges": "bytes",
                    "Content-Length": chunksize,
                    "Content-Type": "video/mp4"
                });
                result.stream.pipe(res)
            })
            .catch(error => {
                if (debug) console.log(error)
                res.redirect('/')
            })
    } catch (e) {
        if (debug) console.log('Debug: ' + e)
        res.redirect('/')
        next(e)
    }
})

app.get('/', (req, res, next) => {
    try {
        removeOldTorrents().then(() => {
            const compiledFunction = pug.compileFile(__dirname + '/source/views/upload.pug')
            var html = compiledFunction({
                'min_bitrate': bitrateRange.min,
                'max_bitrate': bitrateRange.max,
                'def_bitrate': bitrateRange.default
            })
            res.send(html)
        })
    } catch (e) {
        res.redirect('/')
        next(e)
    }
})

app.post('/upload', upload.single('torrent'), (req, res, next) => {
    try {
        torrent_info = getTorrentFromRequest(req)
        addTorrent(torrent_info.torrent, torrent_info.name)
            .then(hash => {
                removeOldTorrents()
                if ((req.body.view === undefined))
                    addr = '/d/q' + req.body.quality + '/' + hash + '.mp4'
                else
                    addr = '/v/' + hash + '.mp4'
                if (debug) console.log('Debug: ' + 'Redirect: ' + addr)
                res.redirect(addr)
            })
            .catch(error => {
                if (debug) console.log('Debug: ' + error.toString())
                if (debug) console.log('Debug: ' + 'Redirect (on error): /')
                res.redirect('/')
            })
    } catch (e) {
        res.redirect('/')
        next(e)
    }
})

app.listen(process.env.PORT || servingPort, () => {
    if (debug) console.log('Debug: ' + 'Serving')
})