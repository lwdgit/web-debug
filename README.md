#web-debug

> 一个用于辅助前端开发的轻量级调试工具。支持**自动刷新**及**远程调试**。


功能：
===============

本工具会在页面被请求时动态插入livereload及weinre调试标签，同时在自动在后台开启文件watch及weinre后台服务。


* 支持livereload
* 支持在当前页面生成二维码（ctrl+shift+z）
* 支持weinre调试（先前版本采用debuggap, 现弃用）
* 支持动态数据mock, 此功能由`tiny-http`提供。
* 实现类fiddler,chales全局代理，开启此模式可以`在手机端调试任意页面`。

特点：
==============

支持`静态服务器模式`及`代理模式`。可以自动在任意页面注入`script`


安装：
==============

> npm install -g web-debug


使用：
=============

```bash
> web-debug -r ./htdocs -p 8080 --autostart
;开启服务器模式

> web-debug -r ./htdocs -p 7777 --proxy --autostart
;开启全局代理模式，可以调式任意页面
```

参数说明：
=============

-r, --root 静态服务器模式下为web根目录，代理模式下为watch目录
-p, --port 静态服务器模式下为web启动端口，代理模式下为代理监听端口
--autostart 自动打开浏览器
--proxy     启用代理模式，默认为静态服务器模式

>  `ctrl+shift+z`可以显示二维码，方便手机应用（如微信）打开页面


局限性：
=============

局限性主要针对代理模式：

 * 为了保证代理速度，目前只支持uff-8编码的页面，代理gbk页面时会出现乱码
 * 代理会直接放行https请求，所以暂不支持https页面标签动态注入


功能增强计划：
=============

 - [ ] 增加对gbk编码的支持
 - [ ] 增加对自定义`script`的实时注入（目前仅支持livereload.js(实时刷新),qrcode.js(二维码),target.js(远程调试)）
 - [ ] 支持https


Dependencies:
==========

---
chokidar: ^1.3.0
livereload-server-spec: 0.2.3
portfinder: 0.4.0
tiny-http: >=2.0.0
weinre: *
---


