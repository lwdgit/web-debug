var portfinder = require('portfinder'),
    child_process = require('child_process');

var weinrePort = 8133;
portfinder.getPort({
    port: weinrePort
}, function(error, port) {
    if (error) {
        console.warn('The port %s for weinre is already in use!', weinrePort);
        return;
    }
    weinrePort = port;
    console.log('Start weinre at http://127.0.0.1:' + port);
    var weinre = require('weinre');
    var weinreApp = weinre.run({
        all: true,
        httpPort: port,
        boundHost: '0.0.0.0',
        verbose: false,
        debug: false,
        readTimeout: 5,
        deathTimeout: 15
    });

});
exports.port = weinrePort;
