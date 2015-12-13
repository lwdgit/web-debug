#!/usr/bin/env node

var hasStart = false,
    child;

function start() {
    child = require('child_process').fork('worker.js', process.argv.slice(2));
    catchErr(child);

    setTimeout(function() {
        hasStart = true;
    }, 1000);
}

start();

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
