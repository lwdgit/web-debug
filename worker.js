var tinyHttp = require('tiny-http'),
    chokidar = require('chokidar'),
    path = require('path'),
    reload = require('./libs/livereload'),
    proxy = require('./proxy'),weinreport;

var debugType = 'proxy';// server or proxy
var hasStart = false;

var port, webroot;

function init() {
    
    //console.log(process.argv);
    port = process.argv[2];
    webroot = process.argv[3];
    debugType = process.argv[5]? 'proxy' : 'server';
    if (process.argv[6]) {
        weinreport = require('./libs/weinre').port;
    }
    
    webroot = path.resolve(webroot);

    checkReload();
    watch();
}

function AddHandler(lhost, lport) {
    if (!hasStart) {
        if (debugType === 'server') {
            tinyHttp.run(process.argv);
        } else {
            console.log('Watch directory: ' + webroot);
            proxy.start(port, '<script type="text/javascript" charset="utf-8" src="http://' + lhost + ':' + lport + '/livereload.js' + (weinreport ? '?weinreport=' + weinreport : '') + '"></script>\r\n</body>');
        }
        hasStart = true;
    }

    tinyHttp.middleHandle = function(content, conf) {
        if (conf.mime !== 'text/html') return content;
        return content.toString().replace(/<\/body>/i, '<script type="text/javascript" charset="utf-8" src="http://' + lhost + ':' + lport + '/livereload.js"' + weinre.port + '></script>\r\n</body>');
    };

}

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
    };
}


function checkReload(path) {
    reload.checkReload(function(err, host, port) {
        //console.log(err, host, port);
        AddHandler(host, port);
    }, path);
}


function watch() {
    chokidar.watch(webroot + '/**', {
            usePolling: false,
            persistent: true,
            ignoreInitial: true,
            ignorePermissionErrors: true
        })
        .on('change', throttle(checkReload))
        .on('error', function(err) {
            throw new(err);
        });
}

init();

/*process.on('unCaughtException', function(e) {
    console.log('Caught Exception:\n');
    console.log(e.stack);
});*/
