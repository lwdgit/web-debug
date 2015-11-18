#!/usr/bin/env node
var tinyHttp = require('tiny-http'),
    reload = require('./libs/livereload'),
    chokidar = require('chokidar');
        


var AddHandler = function(host, port) {
    tinyHttp.middleHandle = function(content, conf) {
        if (conf.mime !== 'text/html') return content;
        return content.toString().replace(/<\/body>/i, '<script type="text/javascript" charset="utf-8" src="http://' + host + ':' + port + '/livereload.js"></script>\r\n</body>');
    };
};

var conf = tinyHttp.run(process.argv).conf;

var checkReload = function() {
    reload.checkReload(function(err, host, port) {
        //console.log(err, host, port);
        AddHandler(host, port);
    });
};

checkReload();


chokidar.watch(conf.WEB_ROOT, {
    usePolling: false,
    persistent: true,
    ignoreInitial: true
})
.on('add', checkReload)
.on('change', checkReload)
.on('unlink', checkReload)
.on('unlinkDir', checkReload)
.on('error', function(err) {
    console.log(err.trace);
});


/*
process.on('uncaughtException', function(e) {
    console.log(e.stack);
});
*/
