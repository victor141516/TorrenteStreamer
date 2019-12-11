import cors from 'cors'
import express, { Request, Response } from 'express'
import fileupload from 'express-fileupload'
import parseTorrent from 'parse-torrent'
import ParseTorrentFile from 'parse-torrent-file'
import WebTorrent from 'webtorrent'

import * as errors from './errors'
import { getLogger } from './logger'

const torrentClient = new WebTorrent()
const currenStreams: { [key: string]: WebTorrent.TorrentFile } = {}
const app = express()
const logger = getLogger('server')

app.use(fileupload())
app.use(express.json())
app.use(cors())
app.use(express.static('public'))

async function handleMagnetOrTorrent(magnetUriOrTorrent: string | Buffer) {
    const parsedTorrent = parseTorrent(magnetUriOrTorrent)

    const torrentHash = (parsedTorrent as ParseTorrentFile.Instance).infoHash as string
    const magnetURI = parseTorrent.toMagnetURI({ infoHash: torrentHash })

    return new Promise(res => {
        if (torrentClient.get(torrentHash) !== null) res(torrentHash)
        else {
            torrentClient.add(magnetURI, torrent => {
                const orderedFiles = torrent.files.sort((a, b) => b.length - a.length)
                orderedFiles.slice(1).forEach(f => f.deselect())
                const fileToStream = orderedFiles[0]
                currenStreams[torrentHash] = fileToStream
                res(torrentHash)
            })
        }
    })
}

app.post('/send/magnet', async (req: Request, res: Response) => {
    if (!req.body.uri) {
        logger.debug('No magnet URI found')
        res.status(400).send({ code: errors.MISSING_MAGNET_URI, message: 'You must provide a magnet link' })
        return
    }
    const magnetUri = req.body.uri as string
    try {
        const torrentHash = await handleMagnetOrTorrent(magnetUri)
        res.send({ id: torrentHash })
    } catch (err) {
        res.status(400).send({ code: errors.BAD_MAGNET_URI, message: 'The magnet you sent is not valid' })
    }
})

app.post('/send/torrent', async (req: Request, res: Response) => {
    if (!req.files || !req.files['torrent-file']) {
        logger.debug('No torrent file found')
        res.status(400).send({ code: errors.MISSING_TORRENT_FILE, message: 'You must provide a torrent file' })
        return
    }
    const torrentFile = req.files['torrent-file'] as fileupload.UploadedFile
    try {
        const torrentHash = await handleMagnetOrTorrent(torrentFile.data)
        res.send({ id: torrentHash })
    } catch (err) {
        res.status(400).send({ code: errors.BAD_TORRENT_FILE, message: 'The file you sent is not a torrent file or the is corrupted' })
    }
})

app.get('/v/:torrentHash', (req, res) => {
    const torrentHash = req.params.torrentHash
    const fileToStream = currenStreams[torrentHash]
    if (!fileToStream) {
        res.status(404).send({ code: errors.STREAM_NOT_FOUND, message: 'The stream ID you used does not exists' })
        return
    }

    logger.debug('Sending', fileToStream.name)

    const range = req.headers.range
    const totalSize = fileToStream.length
    const headers: { [key: string]: string | number } = {
        'Accept-Ranges': 'bytes',
        'Content-Length': totalSize,
        'Content-Type': 'video/*',
    }
    if (range) {
        const positions = range.replace(/bytes=/, '').split('-')
        const start = parseInt(positions[0], 10)
        const total = totalSize
        const end = positions[1] ? parseInt(positions[1], 10) : total - 1
        headers['Content-Range'] = `bypes${start}-${end}/${totalSize}`
    }

    res.writeHead(200, headers)
    fileToStream.createReadStream().pipe(res)
})

export default app
