#!/usr/bin/env node
var tinyHttp = require('tiny-http');
var File = require('./libs/file.js');

tinyHttp.preHandle = function(req, res) {
    if (require('url').parse(req.url).path === '/xloader.js') {
        res.writeHead('200', 'text/javascript');
        res.end(File.read(require('path').join(__dirname, 'vendor/xloader.js')));
        return false;
    }
};

tinyHttp.middleHandle = function(content, conf) {
    return content.toString().replace(/<\/body>/i, '<script type="text/javascript" charset="utf-8" src="/xloader.js"></script>\r\n</body>');
};
//console.log(tinyHttp)
var conf = tinyHttp.run(process.argv).conf;
require('./libs/livereload').checkReload(conf.WEB_ROOT);
/*
process.on('uncaughtException', function(e) {
    console.log(e.stack);
});
*/
