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
        host: '127.0.0.1', // �����Ǵ��������       
        port: 8081, // �����Ǵ���������˿� 
        path: url.parse(request.url).pathname,       
        method: request.method,
        headers: request.headers     
    };

    console.log(options)
    var req = http.request(options, function(req, res) {
    	//console.log(arguments[0].req.pipe)
        req.pipe(response); // ���pipe��ϲ��
        //console.log(req.url);
    }).end();
}).listen(8080);
