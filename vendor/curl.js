'use strict';
var http = require('http');
var url = require('url');



var proxy = http.createServer(function(request, response) {

    var options = {
        host: '192.168.99.251', // 这里是代理服务器       
        port: 80, // 这里是代理服务器端口 
        path: url.parse(request.url).pathname,       
        method: request.method,
        headers: request.headers     
    };



    //console.log(options);
    var hreq = http.request(options, function(req) {

        

        req.on('data', function(chunk) {

            if (this.buffer || isHTML(this.headers['content-type'])) {
                if (!this.buffer) this.buffer = new Buffer(0)
                this.buffer = buffer_add(this.buffer, chunk);
            }
            else
                response.write(chunk);
            
        })
        req.on('end', function() {
            if (this.buffer) {
                response.write(this.buffer ? this.buffer.toString().replace('</body>', '<script>console.log("haha")</script></body>') : '');
                this.buffer = null;
            }
            response.end();
        });

    	//console.log(arguments[0].req.pipe)
        

        //req.pipe(response); 
        
    });
    request.pipe(hreq);
    /*if (request.method == 'POST') {
        request.on('data', function(d) {
            //console.log(d.toString());
            hreq.write(d);
            
        })
        request.on('end', function() {
            hreq.end('\n');
        })
        request.pipe(hreq);
    } else {
        hreq.end();
    }*/
 
    
}).listen(8000);


/* 
 * 两个buffer对象加起来 
 */
function buffer_add(buf1, buf2) {
    var re = new Buffer(buf1.length + buf2.length);
    buf1.copy(re);
    buf2.copy(re, buf1.length);
    return re;
}

function isHTML(contentType) {
    return contentType ? contentType.indexOf('htm') > -1 ? true : false : false;
}


/* 
 * 从缓存中找到头部结束标记('\r\n\r\n')的位置 
 */
function buffer_find_body(b) {
    for (var i = 0, len = b.length - 3; i < len; i++) {
        if (b[i] == 0x0d && b[i + 1] == 0x0a && b[i + 2] == 0x0d && b[i + 3] == 0x0a) {
            return i + 4;
        }
    }
    return -1;
}
