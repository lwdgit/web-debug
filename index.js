#!/usr/bin/env node

var getOptions = require('./libs/getOptions');
var hasStart = false,
    child, startArgs;



function start(startArgs) {
    child = require('child_process').fork(__dirname + '/worker.js', startArgs);
    catchErr(child);

    setTimeout(function() {
        hasStart = true;
    }, 1000);
}

function restart(e, delay) {
    console.log(e);
    if (hasStart) {
        console.log('Restarting...');
        hasStart = false;
        setTimeout(function() {
            start(startArgs);
        }, delay || 3000);
    } else {
        console.log('Please check the error info...');
        process.exit(0);
    }
}

function catchErr(proc) {
    proc.on('exit', function(e) {
        restart(e, /^\d+$/.test(e) ? 100 : 3000);
    });
    proc.on('uncaughtException', function(e) {
        restart(e);
    });
}


function parseArgs() {
    var options = getOptions(process.argv.slice(2));
    if (options.h) {
        console.log('Please visit https://github.com/lwdgit/web-debug');
        return [];
    }
    var port = options.p || options.port || 8080,
        autostart = options.A || options.autostart || '',
        proxy = options.P || options.proxy || '',
        root = options.r || options.root || '',
        args;
    args = [port, root, autostart, proxy];

    if (options.w || options.weinre) { //如果启用weinre
        args.push(1);
    }
    if (options.n || options.name) {
        require('./libs/hateip').init(options.n || options.name);
    }
    return args;
}

function init() {
    startArgs = parseArgs();
    if (!!startArgs.length) {
        start(startArgs);
    }
}
init();
