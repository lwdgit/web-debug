var http = require('http');
var url = require('url');
//var requestm = require('request');


var proxy = http.createServer(function(request, response) {

    /*var options = {
        url: request.url.substring(1),
        headers: request.headers
    };

    /*console.log(url.parse(request.url.substring(1)));
    requestm(request.url.substring(1), function(error, res, body) {
        if (!error && response.statusCode == 200) {
            //console.log(body); // Show the HTML for the Google homepage.
            response.writeHead(200, res.header);
            response.end(res.body);
        }
    });*/


    var options = {
        host: '127.0.0.1', // 这里是代理服务器       
        port: 80, // 这里是代理服务器端口 
        path: url.parse(request.url).pathname,       
        method: request.method,
        headers: request.headers     
    };

    var type = '';
    var body = '';
    //console.log(options)
    http.request(options, function(req) {
        type = req.headers['content-type'];
        
        req.on('data', function(chunk) {
          body += chunk;
        }).on('end', function() {
            if (type.indexOf('htm') > -1) {
              //console.log(req);
              
            }
            body = null;
        });
    	//console.log(arguments[0].req.pipe)
        req.pipe(response); 
        //console.log(req.url);
    }).end();
}).listen(8000);
