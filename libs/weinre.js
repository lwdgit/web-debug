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
    //console.log('node ' + process.cwd() + '/node_modules/weinre/weinre --boundHost -all- --httpPort ' + port);
    child_process.exec('node ' + process.cwd() + '/node_modules/weinre/weinre --boundHost -all- --httpPort ' + port, function(err) {
        console.error('start weinre error!');
    });
});
exports.port = weinrePort;