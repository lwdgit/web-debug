/**
本模块暂不支持https
*/

var http = require('http');
var net = require('net');
var url = require('url');

var httpInstance, InjectScript;

function request(cReq, cRes) {

    var u = url.parse(cReq.url);

    var options = {
        hostname : u.hostname, 
        port     : u.port || 80,
        path     : u.path,       
        method   : cReq.method,
        headers  : cReq.headers
    };
    delete cReq.headers['accept-encoding'];
    //删除支持gzip声明，防止服务器将代码压缩
    
    var pReq = http.request(options, function(pRes) {
       
        cRes.writeHead(pRes.statusCode, pRes.headers);
        
        var chunk = '';
        if (pRes.headers['content-type'] && pRes.headers['content-type'].indexOf('html') > 0) {
          
        	//console.log(pRes.headers);
            pRes.on('data', function(data) {
        		chunk+=data;
        	});
        	pRes.on('end', function() {
                //cRes.end(chunk);
                //console.log(chunk);
        		cRes.end(chunk.toString().replace(/<\/body>/, InjectScript + '<\/body>'));
        	});
            return;
        }

        pRes.pipe(cRes);
           
    }).on('error', function(e) {
        console.log('request "' + cReq.url + '" error!');
        cRes.writeHead(404);
        cRes.end();
    });

    cReq.pipe(pReq);
}

function connect(req, socket) {
    //console.log('connect');
    var url, host, port;
    if ((url = req.url.split(':')).length > 1) {
        port = url[1];
    } else {
        port = 80;
    } 
    host = url[0];

    var mediator = net.createConnection(port, host);
    mediator.on('connect', function () {
        //console.log('connected %s', req.url);
        socket.write("HTTP/1.1 200 Connection established\r\n\r\n");
    });
    mediator.on('error', function() {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        console.log('connect ' + req.url + ' error!');
    });
    socket.pipe(mediator).pipe(socket);
}

var start = exports.start = function(port, script) {
	httpInstance = http.createServer(request).on('connect', connect).listen((port=port || 7777), '0.0.0.0');
	InjectScript = script || '<script>console.log("%cInject Success!","font-size:40px");</script>';
	console.log('Proxy listen at:' + port);
    httpInstance.on('error', function(e) {
        console.log('error');
    });
};

exports.stop = function() {
	if (httpInstance) {
		httpInstance.stopServer();
		httpInstance = null;
	}
};



