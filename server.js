var express = require('express')
  , logger = require('morgan')
  , jade = require('jade')
  , app = express()
  , bodyParser = require('body-parser')
  , multer  = require('multer')
  , upload = multer({ dest: 'uploads/' })

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
            res.send(req.body.magnet)
        } else if (undefined !== req.body.torrent) {
            console.log(req.file)
            res.send(req.file)
        }
    } catch (e) {
        next(e)
    }
})

app.listen(process.env.PORT || 3000, function () {
    console.log('Listening on http://localhost:' + (process.env.PORT || 3000))
})