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

function throttle(fn, timeout) {
    var tId, isRun;
    return function() {
        if (isRun) return;
        clearTimeout(tId);
        var argv = arguments;
        tId = setTimeout(function() {
            isRun = true;
            fn.apply(this, argv);
            setTimeout(function() {
                isRun = false;
            }, timeout);
        }.bind(this), timeout || 300);
    }
}

var conf = tinyHttp.run(process.argv).conf;

var checkReload = function(path) {
    reload.checkReload(function(err, host, port) {
        //console.log(err, host, port);
        AddHandler(host, port);
    }, path);
};

checkReload();

function watch() {
chokidar.watch(conf.WEB_ROOT + '/**', {
    usePolling: false,
    persistent: true,
    ignoreInitial: true,
    ignorePermissionErrors: true
})
.on('change', throttle(checkReload))
.on('error', function(err) {
    console.log(err);
});
}
if (process.platform.indexOf('darwin') === -1) {
    watch();
}
