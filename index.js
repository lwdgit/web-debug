#!/usr/bin/env node

var getOptions = require('./libs/getOptions');
var hasStart = false,
    child;



function start(startArgs) {
    child = require('child_process').fork('worker.js', startArgs);
    catchErr(child);

    setTimeout(function() {
        hasStart = true;
    }, 1000);
}


function catchErr(proc) {
    proc.on('unCaughtException', function(e) {
        console.log(e.stack);
        if (hasStart) {
            console.log('Caught Exception, auto restarting...');
            child.exit(0);
            hasStart = false;
            setTimeout(start, 5000);
        } else {
            console.log('Please check the error info...');
            process.exit(0);
        }
    });
}


function parseArgs() {
    var options = getOptions(process.argv.slice(2));
    if (options.h) {
        console.log('Please visit https://github.com/lwdgit/web-debug');
        return [];
    }
    var port = options.p || options.port || 8080,
    root = options.r || options.root || process.cwd(),
    autostart = options.A || options.autostart || '',
    proxy = options.P || options.proxy || '',
     args;
    args = [port, root, autostart, proxy];
    return args;
}

function init() {
    var args = parseArgs();
    if (!!args.length) {
        start(args);
    }
}
init();