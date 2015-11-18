var fs = require('fs');
var _ = {
    toArray: function() {
        return [].slice.call(arguments[0]);
    },
    map: function(obj, callback, merge) {
        var index = 0;
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (merge) {
                    callback[key] = obj[key];
                } else if (callback(key, obj[key], index++)) {
                    break;
                }
            }
        }
    }
};
var portfinder = require('portfinder');
var rLivereload = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(<\/body>|<!--livereload-->)/ig;
var LRServer;
var LRPORT;

var defaultHostname = (function() {
    var ip = false;
    var net = require('os').networkInterfaces();
    Object.keys(net).every(function(key) {
        var detail = net[key];
        Object.keys(detail).every(function(i) {
            var address = String(detail[i].address).trim();
            if (address && /^\d+(?:\.\d+){3}$/.test(address) && address !== '127.0.0.1') {
                ip = address;
            }
            return !ip; // 找到了，则跳出循环
        });
        return !ip; // 找到了，则跳出循环
    });
    return ip || '127.0.0.1';
})();

function makeLiveServer(callback) {
    if (LRServer) return callback(null, LRServer, LRPORT);

    var basePort = 8132;

    // 获取下一个可用端口。
    portfinder.getPort({
        port: basePort
    }, function(error, port) {
        if (error) {
            console.warn('The port %s for livereload is already in use!', basePort);
            return callback(error);
        }

        LRPORT = port;
        var LiveReloadServer = require('livereload-server-spec');

        LRServer = new LiveReloadServer({
            id: 'com.baidu.fis',
            name: 'fis-reload',
            version: require('../package.json').version,
            port: port,
            protocols: {
                monitoring: 7
            }
        });

        LRServer.on('livereload.js', function(req, res) {
            var script = fs.readFileSync(__dirname + '/../vendor/livereload.js');
            res.writeHead(200, {
                'Content-Length': script.length,
                'Content-Type': 'text/javascript',
                'Connection': 'close'
            });
            res.end(script);
        });
        
        LRServer.on('httprequest', function(url, req, res) {
            var script = fs.readFileSync(__dirname + '/../vendor' + url.pathname);
            res.writeHead(200, {
                'Content-Length': script.length,
                'Content-Type': 'text/javascript',
                'Connection': 'close'
            });
            res.end(script);
        });

        LRServer.listen(function(err) {
            if (err) {
                err.message = 'LiveReload server Listening failed: ' + err.message;
                console.error(err);
            }
        });

        process.stdout.write('LiveReload Server Listening at ' + port + '\n');

        // fix mac livereload
        process.on('uncaughtException', function(err) {
            if (err.message !== 'read ECONNRESET') throw err;
        });


        callback(null, LRServer, LRPORT);
    });
}

function reload(callback) {
    makeLiveServer(function(error, server, port) {
        if (error) {
            return callback(error);
        }

        if (server && server.connections) {
            _.map(server.connections, function(id, connection) {
                try {
                    connection.send({
                        command: 'reload',
                        path: '*',
                        liveCSS: true
                    });
                } catch (e) {
                    try {
                        connection.close();
                    } catch (e) {}
                    delete server.connections[id];
                }
            });
        }

        callback(null, defaultHostname, port);
    });
}

function checkReload(next) {
    reload(next);
}

exports.checkReload = checkReload;

