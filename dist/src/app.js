"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const parse_torrent_1 = __importDefault(require("parse-torrent"));
const webtorrent_1 = __importDefault(require("webtorrent"));
const errors = __importStar(require("./errors"));
const logger_1 = require("./logger");
const torrentClient = new webtorrent_1.default();
const currenStreams = {};
const app = express_1.default();
const logger = logger_1.getLogger('server');
app.use(express_fileupload_1.default());
app.use(express_1.default.json());
app.use(cors_1.default());
app.use(express_1.default.static('public'));
async function handleMagnetOrTorrent(magnetUriOrTorrent) {
    const parsedTorrent = parse_torrent_1.default(magnetUriOrTorrent);
    const torrentHash = parsedTorrent.infoHash;
    const magnetURI = parse_torrent_1.default.toMagnetURI({ infoHash: torrentHash });
    return new Promise(res => {
        if (torrentClient.get(torrentHash) !== null)
            res(torrentHash);
        else {
            torrentClient.add(magnetURI, torrent => {
                const orderedFiles = torrent.files.sort((a, b) => b.length - a.length);
                orderedFiles.slice(1).forEach(f => f.deselect());
                const fileToStream = orderedFiles[0];
                currenStreams[torrentHash] = fileToStream;
                res(torrentHash);
            });
        }
    });
}
app.post('/send/magnet', async (req, res) => {
    if (!req.body.uri) {
        logger.debug('No magnet URI found');
        res.status(400).send({ code: errors.MISSING_MAGNET_URI, message: 'You must provide a magnet link' });
        return;
    }
    const magnetUri = req.body.uri;
    try {
        const torrentHash = await handleMagnetOrTorrent(magnetUri);
        res.send({ id: torrentHash });
    }
    catch (err) {
        res.status(400).send({ code: errors.BAD_MAGNET_URI, message: 'The magnet you sent is not valid' });
    }
});
app.post('/send/torrent', async (req, res) => {
    if (!req.files || !req.files['torrent-file']) {
        logger.debug('No torrent file found');
        res.status(400).send({ code: errors.MISSING_TORRENT_FILE, message: 'You must provide a torrent file' });
        return;
    }
    const torrentFile = req.files['torrent-file'];
    try {
        const torrentHash = await handleMagnetOrTorrent(torrentFile.data);
        res.send({ id: torrentHash });
    }
    catch (err) {
        res.status(400).send({ code: errors.BAD_TORRENT_FILE, message: 'The file you sent is not a torrent file or the is corrupted' });
    }
});
app.get('/v/:torrentHash', (req, res) => {
    const torrentHash = req.params.torrentHash;
    const fileToStream = currenStreams[torrentHash];
    if (!fileToStream) {
        res.status(404).send({ code: errors.STREAM_NOT_FOUND, message: 'The stream ID you used does not exists' });
        return;
    }
    logger.debug('Sending', fileToStream.name);
    const range = req.headers.range;
    const totalSize = fileToStream.length;
    const headers = {
        'Accept-Ranges': 'bytes',
        'Content-Length': totalSize,
        'Content-Type': 'video/*',
    };
    if (range) {
        const positions = range.replace(/bytes=/, '').split('-');
        const start = parseInt(positions[0], 10);
        const total = totalSize;
        const end = positions[1] ? parseInt(positions[1], 10) : total - 1;
        headers['Content-Range'] = `bypes${start}-${end}/${totalSize}`;
    }
    res.writeHead(200, headers);
    fileToStream.createReadStream().pipe(res);
});
exports.default = app;
//# sourceMappingURL=app.js.map