/**
 * Hateip
 */
var hateip = require('hateip');
exports.init = function(subname) {
    require('child_process').exec(__dirname + '/../node_modules/hateip/bin/run --name ' + subname, function(err, stdout, stderr) {
        if (err || stderr) {
            console.log(err.stack || err || stderr);
        } else if (stdout) {
            console.log(stdout);
        }
    });
};
