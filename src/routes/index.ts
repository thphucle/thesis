var path = require("path");
var config = require("libs/config");
var express = require('express');
var router = express.Router();
var fs = require('fs');
var userCtrl = require('../controllers/v1/user');
var v1 = require("./v1");
var tradeCtrl = require('../controllers/v1/trade');
var isTestMode = process.env.NODE_ENV === 'development';

router.use("/api/v1", v1);
router.all('/test', function (req, res) {
    res.send({
        query: req.query,
        body: req.body,
        params: req.params,
        headers: req.headers,
        files: req.files
    });
});

if (isTestMode) {
  var emailTemplate = require('./email-test');
  router.use("/email-template", emailTemplate);
}

router.post("/upload", function(req, res) {
  res.send({
    code: 0,
    message: 'success'
  })
});

router.get('/verify/:username/:code', userCtrl.verify);

router.get('/api/ticker', tradeCtrl.coinmarketcapInfo);

if (config.server.index_html) {
  var indexHtmlPath = path.join(__dirname, '..', config.server.index_html);
  router.get("/*", function(req, res) {
    console.log('GET /*');
    console.log({
        query: req.query,
        body: req.body,
        params: req.params,
        headers: req.headers,
        files: req.files
    });
  
    let stream = fs.createReadStream(indexHtmlPath);
    stream.on('error', (e) => {
      var NOW = new Date();
      res.send(NOW + ': Please contact admin');
      console.error(NOW);
      console.error(e.stack);
    });
    stream.on('readable', () => stream.pipe(res));
  });
}

export = router;
