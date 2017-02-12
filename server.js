var express = require('express')
  , logger = require('morgan')
  , jade = require('jade')
  , app = express()

app.use(logger('dev'))
app.use(express.static(__dirname + '/static'))

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

app.listen(process.env.PORT || 3000, function () {
  console.log('Listening on http://localhost:' + (process.env.PORT || 3000))
})