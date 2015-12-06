(function() {
    var __customevents = {},
        __protocol = {},
        __connector = {},
        __timer = {},
        __options = {},
        __reloader = {},
        __livereload = {},
        __less = {},
        __startup = {};

    // customevents
    var CustomEvents;
    CustomEvents = {
        bind: function(element, eventName, handler) {
            if (element.addEventListener) {
                return element.addEventListener(eventName, handler, false);
            } else if (element.attachEvent) {
                element[eventName] = 1;
                return element.attachEvent('onpropertychange', function(event) {
                    if (event.propertyName === eventName) {
                        return handler();
                    }
                });
            } else {
                throw new Error("Attempt to attach custom event " + eventName + " to something which isn't a DOMElement");
            }
        },
        fire: function(element, eventName) {
            var event;
            if (element.addEventListener) {
                event = document.createEvent('HTMLEvents');
                event.initEvent(eventName, true, true);
                return document.dispatchEvent(event);
            } else if (element.attachEvent) {
                if (element[eventName]) {
                    return element[eventName]++;
                }
            } else {
                throw new Error("Attempt to fire custom event " + eventName + " on something which isn't a DOMElement");
            }
        }
    };
    __customevents.bind = CustomEvents.bind;
    __customevents.fire = CustomEvents.fire;

    // protocol
    var PROTOCOL_6, PROTOCOL_7, Parser, ProtocolError;
    var __indexOf = Array.prototype.indexOf || function(item) {
        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i] === item) return i;
        }
        return -1;
    };
    __protocol.PROTOCOL_6 = PROTOCOL_6 = 'http://livereload.com/protocols/official-6';
    __protocol.PROTOCOL_7 = PROTOCOL_7 = 'http://livereload.com/protocols/official-7';
    __protocol.ProtocolError = ProtocolError = (function() {
        function ProtocolError(reason, data) {
            this.message = "LiveReload protocol error (" + reason + ") after receiving data: \"" + data + "\".";
        }
        return ProtocolError;
    })();
    __protocol.Parser = Parser = (function() {
        function Parser(handlers) {
            this.handlers = handlers;
            this.reset();
        }
        Parser.prototype.reset = function() {
            return this.protocol = null;
        };
        Parser.prototype.process = function(data) {
            var command, message, options, _ref;
            try {
                if (!(this.protocol != null)) {
                    if (data.match(/^!!ver:([\d.]+)$/)) {
                        this.protocol = 6;
                    } else if (message = this._parseMessage(data, ['hello'])) {
                        if (!message.protocols.length) {
                            throw new ProtocolError("no protocols specified in handshake message");
                        } else if (__indexOf.call(message.protocols, PROTOCOL_7) >= 0) {
                            this.protocol = 7;
                        } else if (__indexOf.call(message.protocols, PROTOCOL_6) >= 0) {
                            this.protocol = 6;
                        } else {
                            throw new ProtocolError("no supported protocols found");
                        }
                    }
                    return this.handlers.connected(this.protocol);
                } else if (this.protocol === 6) {
                    message = JSON.parse(data);
                    if (!message.length) {
                        throw new ProtocolError("protocol 6 messages must be arrays");
                    }
                    command = message[0], options = message[1];
                    if (command !== 'refresh') {
                        throw new ProtocolError("unknown protocol 6 command");
                    }
                    return this.handlers.message({
                        command: 'reload',
                        path: options.path,
                        liveCSS: (_ref = options.apply_css_live) != null ? _ref : true
                    });
                } else {
                    message = this._parseMessage(data, ['reload', 'alert']);
                    return this.handlers.message(message);
                }
            } catch (e) {
                if (e instanceof ProtocolError) {
                    return this.handlers.error(e);
                } else {
                    throw e;
                }
            }
        };
        Parser.prototype._parseMessage = function(data, validCommands) {
            var message, _ref;
            try {
                message = JSON.parse(data);
            } catch (e) {
                throw new ProtocolError('unparsable JSON', data);
            }
            if (!message.command) {
                throw new ProtocolError('missing "command" key', data);
            }
            if (_ref = message.command, __indexOf.call(validCommands, _ref) < 0) {
                throw new ProtocolError("invalid command '" + message.command + "', only valid commands are: " + (validCommands.join(', ')) + ")", data);
            }
            return message;
        };
        return Parser;
    })();

    // connector
    // Generated by CoffeeScript 1.3.3
    var Connector, PROTOCOL_6, PROTOCOL_7, Parser, Version, _ref;

    _ref = __protocol, Parser = _ref.Parser, PROTOCOL_6 = _ref.PROTOCOL_6, PROTOCOL_7 = _ref.PROTOCOL_7;

    Version = '2.0.8';

    __connector.Connector = Connector = (function() {

        function Connector(options, WebSocket, Timer, handlers) {
            var _this = this;
            this.options = options;
            this.WebSocket = WebSocket;
            this.Timer = Timer;
            this.handlers = handlers;
            this._uri = "ws://" + this.options.host + ":" + this.options.port + "/livereload";
            this._nextDelay = this.options.mindelay;
            this._connectionDesired = false;
            this.protocol = 0;
            this.protocolParser = new Parser({
                connected: function(protocol) {
                    _this.protocol = protocol;
                    _this._handshakeTimeout.stop();
                    _this._nextDelay = _this.options.mindelay;
                    _this._disconnectionReason = 'broken';
                    return _this.handlers.connected(protocol);
                },
                error: function(e) {
                    _this.handlers.error(e);
                    return _this._closeOnError();
                },
                message: function(message) {
                    return _this.handlers.message(message);
                }
            });
            this._handshakeTimeout = new Timer(function() {
                if (!_this._isSocketConnected()) {
                    return;
                }
                _this._disconnectionReason = 'handshake-timeout';
                return _this.socket.close();
            });
            this._reconnectTimer = new Timer(function() {
                if (!_this._connectionDesired) {
                    return;
                }
                return _this.connect();
            });
            this.connect();
        }

        Connector.prototype._isSocketConnected = function() {
            return this.socket && this.socket.readyState === this.WebSocket.OPEN;
        };

        Connector.prototype.connect = function() {
            var _this = this;
            this._connectionDesired = true;
            if (this._isSocketConnected()) {
                return;
            }
            this._reconnectTimer.stop();
            this._disconnectionReason = 'cannot-connect';
            this.protocolParser.reset();
            this.handlers.connecting();
            this.socket = new this.WebSocket(this._uri);
            this.socket.onopen = function(e) {
                return _this._onopen(e);
            };
            this.socket.onclose = function(e) {
                return _this._onclose(e);
            };
            this.socket.onmessage = function(e) {
                return _this._onmessage(e);
            };
            return this.socket.onerror = function(e) {
                return _this._onerror(e);
            };
        };

        Connector.prototype.disconnect = function() {
            this._connectionDesired = false;
            this._reconnectTimer.stop();
            if (!this._isSocketConnected()) {
                return;
            }
            this._disconnectionReason = 'manual';
            return this.socket.close();
        };

        Connector.prototype._scheduleReconnection = function() {
            if (!this._connectionDesired) {
                return;
            }
            if (!this._reconnectTimer.running) {
                this._reconnectTimer.start(this._nextDelay);
                return this._nextDelay = Math.min(this.options.maxdelay, this._nextDelay * 2);
            }
        };

        Connector.prototype.sendCommand = function(command) {
            if (this.protocol == null) {
                return;
            }
            return this._sendCommand(command);
        };

        Connector.prototype._sendCommand = function(command) {
            return this.socket.send(JSON.stringify(command));
        };

        Connector.prototype._closeOnError = function() {
            this._handshakeTimeout.stop();
            this._disconnectionReason = 'error';
            return this.socket.close();
        };

        Connector.prototype._onopen = function(e) {
            var hello;
            this.handlers.socketConnected();
            this._disconnectionReason = 'handshake-failed';
            hello = {
                command: 'hello',
                protocols: [PROTOCOL_6, PROTOCOL_7]
            };
            hello.ver = Version;
            if (this.options.ext) {
                hello.ext = this.options.ext;
            }
            if (this.options.extver) {
                hello.extver = this.options.extver;
            }
            if (this.options.snipver) {
                hello.snipver = this.options.snipver;
            }
            this._sendCommand(hello);
            return this._handshakeTimeout.start(this.options.handshake_timeout);
        };

        Connector.prototype._onclose = function(e) {
            this.protocol = 0;
            this.handlers.disconnected(this._disconnectionReason, this._nextDelay);
            return this._scheduleReconnection();
        };

        Connector.prototype._onerror = function(e) {};

        Connector.prototype._onmessage = function(e) {
            return this.protocolParser.process(e.data);
        };

        return Connector;

    })();

    // timer
    var Timer;
    var __bind = function(fn, me) {
        return function() {
            return fn.apply(me, arguments);
        };
    };
    __timer.Timer = Timer = (function() {
        function Timer(func) {
            this.func = func;
            this.running = false;
            this.id = null;
            this._handler = __bind(function() {
                this.running = false;
                this.id = null;
                return this.func();
            }, this);
        }
        Timer.prototype.start = function(timeout) {
            if (this.running) {
                clearTimeout(this.id);
            }
            this.id = setTimeout(this._handler, timeout);
            return this.running = true;
        };
        Timer.prototype.stop = function() {
            if (this.running) {
                clearTimeout(this.id);
                this.running = false;
                return this.id = null;
            }
        };
        return Timer;
    })();
    Timer.start = function(timeout, func) {
        return setTimeout(func, timeout);
    };

    // options
    var Options;
    __options.Options = Options = (function() {
        function Options() {
            this.host = null;
            this.port = 35729;
            this.snipver = null;
            this.ext = null;
            this.extver = null;
            this.mindelay = 1000;
            this.maxdelay = 60000;
            this.handshake_timeout = 5000;
        }
        Options.prototype.set = function(name, value) {
            switch (typeof this[name]) {
                case 'undefined':
                    break;
                case 'number':
                    return this[name] = +value;
                default:
                    return this[name] = value;
            }
        };
        return Options;
    })();
    Options.extract = function(document) {
        var element, keyAndValue, m, mm, options, pair, src, _i, _j, _len, _len2, _ref, _ref2;
        _ref = document.getElementsByTagName('script');
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            element = _ref[_i];
            if ((src = element.src) && (m = src.match(/^[^:]+:\/\/(.*)\/z?livereload\.js(?:\?(.*))?$/))) {
                options = new Options();
                if (mm = m[1].match(/^([^\/:]+)(?::(\d+))?$/)) {
                    options.host = mm[1];
                    if (mm[2]) {
                        options.port = parseInt(mm[2], 10);
                    }
                }
                if (m[2]) {
                    _ref2 = m[2].split('&');
                    for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
                        pair = _ref2[_j];
                        if ((keyAndValue = pair.split('=')).length > 1) {
                            options.set(keyAndValue[0].replace(/-/g, '_'), keyAndValue.slice(1).join('='));
                        }
                    }
                }
                return options;
            }
        }
        return null;
    };

    // reloader
    // Generated by CoffeeScript 1.3.1
    (function() {
        var IMAGE_STYLES, Reloader, numberOfMatchingSegments, pathFromUrl, pathsMatch, pickBestMatch, splitUrl;

        splitUrl = function(url) {
            var hash, index, params;
            if ((index = url.indexOf('#')) >= 0) {
                hash = url.slice(index);
                url = url.slice(0, index);
            } else {
                hash = '';
            }
            if ((index = url.indexOf('?')) >= 0) {
                params = url.slice(index);
                url = url.slice(0, index);
            } else {
                params = '';
            }
            return {
                url: url,
                params: params,
                hash: hash
            };
        };

        pathFromUrl = function(url) {
            var path;
            url = splitUrl(url).url;
            if (url.indexOf('file://') === 0) {
                path = url.replace(/^file:\/\/(localhost)?/, '');
            } else {
                path = url.replace(/^([^:]+:)?\/\/([^:\/]+)(:\d*)?\//, '/');
            }
            return decodeURIComponent(path);
        };

        pickBestMatch = function(path, objects, pathFunc) {
            var bestMatch, object, score, _i, _len;
            bestMatch = {
                score: 0
            };
            for (_i = 0, _len = objects.length; _i < _len; _i++) {
                object = objects[_i];
                score = numberOfMatchingSegments(path, pathFunc(object));
                if (score > bestMatch.score) {
                    bestMatch = {
                        object: object,
                        score: score
                    };
                }
            }
            if (bestMatch.score > 0) {
                return bestMatch;
            } else {
                return null;
            }
        };

        numberOfMatchingSegments = function(path1, path2) {
            var comps1, comps2, eqCount, len;
            path1 = path1.replace(/^\/+/, '').toLowerCase();
            path2 = path2.replace(/^\/+/, '').toLowerCase();
            if (path1 === path2) {
                return 10000;
            }
            comps1 = path1.split('/').reverse();
            comps2 = path2.split('/').reverse();
            len = Math.min(comps1.length, comps2.length);
            eqCount = 0;
            while (eqCount < len && comps1[eqCount] === comps2[eqCount]) {
                ++eqCount;
            }
            return eqCount;
        };

        pathsMatch = function(path1, path2) {
            return numberOfMatchingSegments(path1, path2) > 0;
        };

        IMAGE_STYLES = [{
            selector: 'background',
            styleNames: ['backgroundImage']
        }, {
            selector: 'border',
            styleNames: ['borderImage', 'webkitBorderImage', 'MozBorderImage']
        }];

        __reloader.Reloader = Reloader = (function() {

            Reloader.name = 'Reloader';

            function Reloader(window, console, Timer) {
                this.window = window;
                this.console = console;
                this.Timer = Timer;
                this.document = this.window.document;
                this.importCacheWaitPeriod = 200;
                this.plugins = [];
            }

            Reloader.prototype.addPlugin = function(plugin) {
                return this.plugins.push(plugin);
            };

            Reloader.prototype.analyze = function(callback) {
                return results;
            };

            Reloader.prototype.reload = function(path, options) {
                var plugin, _base, _i, _len, _ref;
                this.options = options;
                if ((_base = this.options).stylesheetReloadTimeout == null) {
                    _base.stylesheetReloadTimeout = 15000;
                }
                _ref = this.plugins;
                for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                    plugin = _ref[_i];
                    if (plugin.reload && plugin.reload(path, options)) {
                        return;
                    }
                }
                if (options.liveCSS) {
                    if (path.match(/\.css$/i)) {
                        if (this.reloadStylesheet(path)) {
                            return;
                        }
                    }
                }
                if (options.liveImg) {
                    if (path.match(/\.(jpe?g|png|gif)$/i)) {
                        this.reloadImages(path);
                        return;
                    }
                }
                return this.reloadPage();
            };

            Reloader.prototype.reloadPage = function() {
                return this.window.document.location.reload();
            };

            Reloader.prototype.reloadImages = function(path) {
                var expando, img, selector, styleNames, styleSheet, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref, _ref1, _ref2, _ref3, _results;
                expando = this.generateUniqueString();
                _ref = this.document.images;
                for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                    img = _ref[_i];
                    if (pathsMatch(path, pathFromUrl(img.src))) {
                        img.src = this.generateCacheBustUrl(img.src, expando);
                    }
                }
                if (this.document.querySelectorAll) {
                    for (_j = 0, _len1 = IMAGE_STYLES.length; _j < _len1; _j++) {
                        _ref1 = IMAGE_STYLES[_j], selector = _ref1.selector, styleNames = _ref1.styleNames;
                        _ref2 = this.document.querySelectorAll("[style*=" + selector + "]");
                        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
                            img = _ref2[_k];
                            this.reloadStyleImages(img.style, styleNames, path, expando);
                        }
                    }
                }
                if (this.document.styleSheets) {
                    _ref3 = this.document.styleSheets;
                    _results = [];
                    for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
                        styleSheet = _ref3[_l];
                        _results.push(this.reloadStylesheetImages(styleSheet, path, expando));
                    }
                    return _results;
                }
            };

            Reloader.prototype.reloadStylesheetImages = function(styleSheet, path, expando) {
                var rule, rules, styleNames, _i, _j, _len, _len1;
                try {
                    rules = styleSheet != null ? styleSheet.cssRules : void 0;
                } catch (e) {

                }
                if (!rules) {
                    return;
                }
                for (_i = 0, _len = rules.length; _i < _len; _i++) {
                    rule = rules[_i];
                    switch (rule.type) {
                        case CSSRule.IMPORT_RULE:
                            this.reloadStylesheetImages(rule.styleSheet, path, expando);
                            break;
                        case CSSRule.STYLE_RULE:
                            for (_j = 0, _len1 = IMAGE_STYLES.length; _j < _len1; _j++) {
                                styleNames = IMAGE_STYLES[_j].styleNames;
                                this.reloadStyleImages(rule.style, styleNames, path, expando);
                            }
                            break;
                        case CSSRule.MEDIA_RULE:
                            this.reloadStylesheetImages(rule, path, expando);
                    }
                }
            };

            Reloader.prototype.reloadStyleImages = function(style, styleNames, path, expando) {
                var newValue, styleName, value, _i, _len,
                    _this = this;
                for (_i = 0, _len = styleNames.length; _i < _len; _i++) {
                    styleName = styleNames[_i];
                    value = style[styleName];
                    if (typeof value === 'string') {
                        newValue = value.replace(/\burl\s*\(([^)]*)\)/, function(match, src) {
                            if (pathsMatch(path, pathFromUrl(src))) {
                                return "url(" + (_this.generateCacheBustUrl(src, expando)) + ")";
                            } else {
                                return match;
                            }
                        });
                        if (newValue !== value) {
                            style[styleName] = newValue;
                        }
                    }
                }
            };

            Reloader.prototype.reloadStylesheet = function(path) {
                var imported, link, links, match, style, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref, _ref1,
                    _this = this;
                links = (function() {
                    var _i, _len, _ref, _results;
                    _ref = this.document.getElementsByTagName('link');
                    _results = [];
                    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                        link = _ref[_i];
                        if (link.rel === 'stylesheet' && !link.__LiveReload_pendingRemoval) {
                            _results.push(link);
                        }
                    }
                    return _results;
                }).call(this);
                imported = [];
                _ref = this.document.getElementsByTagName('style');
                for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                    style = _ref[_i];
                    if (style.sheet) {
                        this.collectImportedStylesheets(style, style.sheet, imported);
                    }
                }
                for (_j = 0, _len1 = links.length; _j < _len1; _j++) {
                    link = links[_j];
                    this.collectImportedStylesheets(link, link.sheet, imported);
                }
                if (this.window.StyleFix && this.document.querySelectorAll) {
                    _ref1 = this.document.querySelectorAll('style[data-href]');
                    for (_k = 0, _len2 = _ref1.length; _k < _len2; _k++) {
                        style = _ref1[_k];
                        links.push(style);
                    }
                }
                this.console.log("LiveReload found " + links.length + " LINKed stylesheets, " + imported.length + " @imported stylesheets");
                match = pickBestMatch(path, links.concat(imported), function(l) {
                    return pathFromUrl(_this.linkHref(l));
                });
                if (match) {
                    if (match.object.rule) {
                        this.console.log("LiveReload is reloading imported stylesheet: " + match.object.href);
                        this.reattachImportedRule(match.object);
                    } else {
                        this.console.log("LiveReload is reloading stylesheet: " + (this.linkHref(match.object)));
                        this.reattachStylesheetLink(match.object);
                    }
                } else {
                    this.console.log("LiveReload will reload all stylesheets because path '" + path + "' did not match any specific one");
                    for (_l = 0, _len3 = links.length; _l < _len3; _l++) {
                        link = links[_l];
                        this.reattachStylesheetLink(link);
                    }
                }
                return true;
            };

            Reloader.prototype.collectImportedStylesheets = function(link, styleSheet, result) {
                var index, rule, rules, _i, _len;
                try {
                    rules = styleSheet != null ? styleSheet.cssRules : void 0;
                } catch (e) {

                }
                if (rules && rules.length) {
                    for (index = _i = 0, _len = rules.length; _i < _len; index = ++_i) {
                        rule = rules[index];
                        switch (rule.type) {
                            case CSSRule.CHARSET_RULE:
                                continue;
                            case CSSRule.IMPORT_RULE:
                                result.push({
                                    link: link,
                                    rule: rule,
                                    index: index,
                                    href: rule.href
                                });
                                this.collectImportedStylesheets(link, rule.styleSheet, result);
                                break;
                            default:
                                break;
                        }
                    }
                }
            };

            Reloader.prototype.waitUntilCssLoads = function(clone, func) {
                var callbackExecuted, executeCallback, poll,
                    _this = this;
                callbackExecuted = false;
                executeCallback = function() {
                    if (callbackExecuted) {
                        return;
                    }
                    callbackExecuted = true;
                    return func();
                };
                clone.onload = function() {
                    console.log("onload!");
                    _this.knownToSupportCssOnLoad = true;
                    return executeCallback();
                };
                if (!this.knownToSupportCssOnLoad) {
                    (poll = function() {
                        if (clone.sheet) {
                            console.log("polling!");
                            return executeCallback();
                        } else {
                            return _this.Timer.start(50, poll);
                        }
                    })();
                }
                return this.Timer.start(this.options.stylesheetReloadTimeout, executeCallback);
            };

            Reloader.prototype.linkHref = function(link) {
                return link.href || link.getAttribute('data-href');
            };

            Reloader.prototype.reattachStylesheetLink = function(link) {
                var clone, parent,
                    _this = this;
                if (link.__LiveReload_pendingRemoval) {
                    return;
                }
                link.__LiveReload_pendingRemoval = true;
                if (link.tagName === 'STYLE') {
                    clone = this.document.createElement('link');
                    clone.rel = 'stylesheet';
                    clone.media = link.media;
                    clone.disabled = link.disabled;
                } else {
                    clone = link.cloneNode(false);
                }
                clone.href = this.generateCacheBustUrl(this.linkHref(link));
                parent = link.parentNode;
                if (parent.lastChild === link) {
                    parent.appendChild(clone);
                } else {
                    parent.insertBefore(clone, link.nextSibling);
                }
                return this.waitUntilCssLoads(clone, function() {
                    var additionalWaitingTime;
                    if (/AppleWebKit/.test(navigator.userAgent)) {
                        additionalWaitingTime = 5;
                    } else {
                        additionalWaitingTime = 200;
                    }
                    return _this.Timer.start(additionalWaitingTime, function() {
                        var _ref;
                        if (!link.parentNode) {
                            return;
                        }
                        link.parentNode.removeChild(link);
                        clone.onreadystatechange = null;
                        return (_ref = _this.window.StyleFix) != null ? _ref.link(clone) : void 0;
                    });
                });
            };

            Reloader.prototype.reattachImportedRule = function(_arg) {
                var href, index, link, media, newRule, parent, rule, tempLink,
                    _this = this;
                rule = _arg.rule, index = _arg.index, link = _arg.link;
                parent = rule.parentStyleSheet;
                href = this.generateCacheBustUrl(rule.href);
                media = rule.media.length ? [].join.call(rule.media, ', ') : '';
                newRule = "@import url(\"" + href + "\") " + media + ";";
                rule.__LiveReload_newHref = href;
                tempLink = this.document.createElement("link");
                tempLink.rel = 'stylesheet';
                tempLink.href = href;
                tempLink.__LiveReload_pendingRemoval = true;
                if (link.parentNode) {
                    link.parentNode.insertBefore(tempLink, link);
                }
                return this.Timer.start(this.importCacheWaitPeriod, function() {
                    if (tempLink.parentNode) {
                        tempLink.parentNode.removeChild(tempLink);
                    }
                    if (rule.__LiveReload_newHref !== href) {
                        return;
                    }
                    parent.insertRule(newRule, index);
                    parent.deleteRule(index + 1);
                    rule = parent.cssRules[index];
                    rule.__LiveReload_newHref = href;
                    return _this.Timer.start(_this.importCacheWaitPeriod, function() {
                        if (rule.__LiveReload_newHref !== href) {
                            return;
                        }
                        parent.insertRule(newRule, index);
                        return parent.deleteRule(index + 1);
                    });
                });
            };

            Reloader.prototype.generateUniqueString = function() {
                return 'livereload=' + Date.now();
            };

            Reloader.prototype.generateCacheBustUrl = function(url, expando) {
                var hash, oldParams, params, _ref;
                if (expando == null) {
                    expando = this.generateUniqueString();
                }
                _ref = splitUrl(url), url = _ref.url, hash = _ref.hash, oldParams = _ref.params;
                if (this.options.overrideURL) {
                    if (url.indexOf(this.options.serverURL) < 0) {
                        url = this.options.serverURL + this.options.overrideURL + "?url=" + encodeURIComponent(url);
                    }
                }
                params = oldParams.replace(/(\?|&)livereload=(\d+)/, function(match, sep) {
                    return "" + sep + expando;
                });
                if (params === oldParams) {
                    if (oldParams.length === 0) {
                        params = "?" + expando;
                    } else {
                        params = "" + oldParams + "&" + expando;
                    }
                }
                return url + params + hash;
            };

            return Reloader;

        })();

    }).call(this);

    // livereload
    var Connector, LiveReload, Options, Reloader, Timer;

    Connector = __connector.Connector;

    Timer = __timer.Timer;

    Options = __options.Options;

    Reloader = __reloader.Reloader;

    __livereload.LiveReload = LiveReload = (function() {

        function LiveReload(window) {
            var _this = this;
            this.window = window;
            this.listeners = {};
            this.plugins = [];
            this.pluginIdentifiers = {};
            this.console = this.window.location.href.match(/LR-verbose/) && this.window.console && this.window.console.log && this.window.console.error ? this.window.console : {
                log: function() {},
                error: function() {}
            };
            if (!(this.WebSocket = this.window.WebSocket || this.window.MozWebSocket)) {
                console.error("LiveReload disabled because the browser does not seem to support web sockets");
                return;
            }
            if (!(this.options = Options.extract(this.window.document))) {
                console.error("LiveReload disabled because it could not find its own <SCRIPT> tag");
                return;
            }
            this.reloader = new Reloader(this.window, this.console, Timer);
            this.connector = new Connector(this.options, this.WebSocket, Timer, {
                connecting: function() {},
                socketConnected: function() {},
                connected: function(protocol) {
                    var _base;
                    if (typeof(_base = _this.listeners).connect === "function") {
                        _base.connect();
                    }
                    _this.log("LiveReload is connected to " + _this.options.host + ":" + _this.options.port + " (protocol v" + protocol + ").");
                    return _this.analyze();
                },
                error: function(e) {
                    if (e instanceof ProtocolError) {
                        return console.log("" + e.message + ".");
                    } else {
                        return console.log("LiveReload internal error: " + e.message);
                    }
                },
                disconnected: function(reason, nextDelay) {
                    var _base;
                    if (typeof(_base = _this.listeners).disconnect === "function") {
                        _base.disconnect();
                    }
                    switch (reason) {
                        case 'cannot-connect':
                            return _this.log("LiveReload cannot connect to " + _this.options.host + ":" + _this.options.port + ", will retry in " + nextDelay + " sec.");
                        case 'broken':
                            return _this.log("LiveReload disconnected from " + _this.options.host + ":" + _this.options.port + ", reconnecting in " + nextDelay + " sec.");
                        case 'handshake-timeout':
                            return _this.log("LiveReload cannot connect to " + _this.options.host + ":" + _this.options.port + " (handshake timeout), will retry in " + nextDelay + " sec.");
                        case 'handshake-failed':
                            return _this.log("LiveReload cannot connect to " + _this.options.host + ":" + _this.options.port + " (handshake failed), will retry in " + nextDelay + " sec.");
                        case 'manual':
                            break;
                        case 'error':
                            break;
                        default:
                            return _this.log("LiveReload disconnected from " + _this.options.host + ":" + _this.options.port + " (" + reason + "), reconnecting in " + nextDelay + " sec.");
                    }
                },
                message: function(message) {
                    switch (message.command) {
                        case 'reload':
                            return _this.performReload(message);
                        case 'alert':
                            return _this.performAlert(message);
                    }
                }
            });
        }

        LiveReload.prototype.on = function(eventName, handler) {
            return this.listeners[eventName] = handler;
        };

        LiveReload.prototype.log = function(message) {
            return this.console.log("" + message);
        };

        LiveReload.prototype.performReload = function(message) {
            var _ref, _ref2;
            this.log("LiveReload received reload request for " + message.path + ".");
            return this.reloader.reload(message.path, {
                liveCSS: (_ref = message.liveCSS) != null ? _ref : true,
                liveImg: (_ref2 = message.liveImg) != null ? _ref2 : true,
                originalPath: message.originalPath || '',
                overrideURL: message.overrideURL || '',
                serverURL: "http://" + this.options.host + ":" + this.options.port
            });
        };

        LiveReload.prototype.performAlert = function(message) {
            return alert(message.message);
        };

        LiveReload.prototype.shutDown = function() {
            var _base;
            this.connector.disconnect();
            this.log("LiveReload disconnected.");
            return typeof(_base = this.listeners).shutdown === "function" ? _base.shutdown() : void 0;
        };

        LiveReload.prototype.hasPlugin = function(identifier) {
            return !!this.pluginIdentifiers[identifier];
        };

        LiveReload.prototype.addPlugin = function(pluginClass) {
            var plugin;
            var _this = this;
            if (this.hasPlugin(pluginClass.identifier)) return;
            this.pluginIdentifiers[pluginClass.identifier] = true;
            plugin = new pluginClass(this.window, {
                _livereload: this,
                _reloader: this.reloader,
                _connector: this.connector,
                console: this.console,
                Timer: Timer,
                generateCacheBustUrl: function(url) {
                    return _this.reloader.generateCacheBustUrl(url);
                }
            });
            this.plugins.push(plugin);
            this.reloader.addPlugin(plugin);
        };

        LiveReload.prototype.analyze = function() {
            var plugin, pluginData, pluginsData, _i, _len, _ref;
            if (!(this.connector.protocol >= 7)) return;
            pluginsData = {};
            _ref = this.plugins;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                plugin = _ref[_i];
                pluginsData[plugin.constructor.identifier] = pluginData = (typeof plugin.analyze === "function" ? plugin.analyze() : void 0) || {};
                pluginData.version = plugin.constructor.version;
            }
            this.connector.sendCommand({
                command: 'info',
                plugins: pluginsData,
                url: this.window.location.href
            });
        };

        return LiveReload;

    })();

    // less
    var LessPlugin;
    __less = LessPlugin = (function() {
        LessPlugin.identifier = 'less';
        LessPlugin.version = '1.0';

        function LessPlugin(window, host) {
            this.window = window;
            this.host = host;
        }
        LessPlugin.prototype.reload = function(path, options) {
            if (this.window.less && this.window.less.refresh) {
                if (path.match(/\.less$/i)) {
                    return this.reloadLess(path);
                }
                if (options.originalPath.match(/\.less$/i)) {
                    return this.reloadLess(options.originalPath);
                }
            }
            return false;
        };
        LessPlugin.prototype.reloadLess = function(path) {
            var link, links, _i, _len;
            links = (function() {
                var _i, _len, _ref, _results;
                _ref = document.getElementsByTagName('link');
                _results = [];
                for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                    link = _ref[_i];
                    if (link.href && link.rel === 'stylesheet/less' || (link.rel.match(/stylesheet/) && link.type.match(/^text\/(x-)?less$/))) {
                        _results.push(link);
                    }
                }
                return _results;
            })();
            if (links.length === 0) {
                return false;
            }
            for (_i = 0, _len = links.length; _i < _len; _i++) {
                link = links[_i];
                link.href = this.host.generateCacheBustUrl(link.href);
            }
            this.host.console.log("LiveReload is asking LESS to recompile all stylesheets");
            this.window.less.refresh(true);
            return true;
        };
        LessPlugin.prototype.analyze = function() {
            return {
                disable: !!(this.window.less && this.window.less.refresh)
            };
        };
        return LessPlugin;
    })();

    // startup
    var CustomEvents, LiveReload, k;
    CustomEvents = __customevents;
    LiveReload = window.LiveReload = new(__livereload.LiveReload)(window);
    for (k in window) {
        if (k.match(/^LiveReloadPlugin/)) {
            LiveReload.addPlugin(window[k]);
        }
    }
    LiveReload.addPlugin(__less);
    LiveReload.on('shutdown', function() {
        return delete window.LiveReload;
    });
    LiveReload.on('connect', function() {
        return CustomEvents.fire(document, 'LiveReloadConnect');
    });
    LiveReload.on('disconnect', function() {
        return CustomEvents.fire(document, 'LiveReloadDisconnect');
    });
    CustomEvents.bind(document, 'LiveReloadShutDown', function() {
        return LiveReload.shutDown();
    });
})();

/*from tccdn minify at 2014-6-4 14:59:43,file：/cn/c/c/qrcode.js*/
/**
 * @fileoverview
 * - Using the 'QRCode for Javascript library'
 * - Fixed dataset of 'QRCode for Javascript library' for support full-spec.
 * - this library has no dependencies.
 * 
 * @author davidshimjs
 * @see <a href="http://www.d-project.com/" target="_blank">http://www.d-project.com/</a>
 * @see <a href="http://jeromeetienne.github.com/jquery-qrcode/" target="_blank">http://jeromeetienne.github.com/jquery-qrcode/</a>
 */
var QRCode;

(function() {
    //---------------------------------------------------------------------
    // QRCode for JavaScript
    //
    // Copyright (c) 2009 Kazuhiko Arase
    //
    // URL: http://www.d-project.com/
    //
    // Licensed under the MIT license:
    //   http://www.opensource.org/licenses/mit-license.php
    //
    // The word "QR Code" is registered trademark of 
    // DENSO WAVE INCORPORATED
    //   http://www.denso-wave.com/qrcode/faqpatent-e.html
    //
    //---------------------------------------------------------------------
    function QR8bitByte(data) {
        this.mode = QRMode.MODE_8BIT_BYTE;
        this.data = data;
        this.parsedData = [];

        // Added to support UTF-8 Characters
        for (var i = 0, l = this.data.length; i < l; i++) {
            var byteArray = [];
            var code = this.data.charCodeAt(i);

            if (code > 0x10000) {
                byteArray[0] = 0xF0 | ((code & 0x1C0000) >>> 18);
                byteArray[1] = 0x80 | ((code & 0x3F000) >>> 12);
                byteArray[2] = 0x80 | ((code & 0xFC0) >>> 6);
                byteArray[3] = 0x80 | (code & 0x3F);
            } else if (code > 0x800) {
                byteArray[0] = 0xE0 | ((code & 0xF000) >>> 12);
                byteArray[1] = 0x80 | ((code & 0xFC0) >>> 6);
                byteArray[2] = 0x80 | (code & 0x3F);
            } else if (code > 0x80) {
                byteArray[0] = 0xC0 | ((code & 0x7C0) >>> 6);
                byteArray[1] = 0x80 | (code & 0x3F);
            } else {
                byteArray[0] = code;
            }

            this.parsedData.push(byteArray);
        }

        this.parsedData = Array.prototype.concat.apply([], this.parsedData);

        if (this.parsedData.length != this.data.length) {
            this.parsedData.unshift(191);
            this.parsedData.unshift(187);
            this.parsedData.unshift(239);
        }
    }

    QR8bitByte.prototype = {
        getLength: function(buffer) {
            return this.parsedData.length;
        },
        write: function(buffer) {
            for (var i = 0, l = this.parsedData.length; i < l; i++) {
                buffer.put(this.parsedData[i], 8);
            }
        }
    };

    function QRCodeModel(typeNumber, errorCorrectLevel) {
        this.typeNumber = typeNumber;
        this.errorCorrectLevel = errorCorrectLevel;
        this.modules = null;
        this.moduleCount = 0;
        this.dataCache = null;
        this.dataList = [];
    }

    function QRPolynomial(num, shift) {
        if (num.length == undefined) throw new Error(num.length + "/" + shift);
        var offset = 0;
        while (offset < num.length && num[offset] == 0) offset++;
        this.num = new Array(num.length - offset + shift);
        for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    }

    function QRRSBlock(totalCount, dataCount) {
        this.totalCount = totalCount, this.dataCount = dataCount;
    }

    function QRBitBuffer() {
        this.buffer = [], this.length = 0;
    }

    QRCodeModel.prototype = {
        "addData": function(data) {
            var newData = new QR8bitByte(data);
            this.dataList.push(newData), this.dataCache = null;
        },
        "isDark": function(row, col) {
            if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) throw new Error(row + "," + col);
            return this.modules[row][col];
        },
        "getModuleCount": function() {
            return this.moduleCount;
        },
        "make": function() {
            this.makeImpl(!1, this.getBestMaskPattern());
        },
        "makeImpl": function(test, maskPattern) {
            this.moduleCount = this.typeNumber * 4 + 17, this.modules = new Array(this.moduleCount);
            for (var row = 0; row < this.moduleCount; row++) {
                this.modules[row] = new Array(this.moduleCount);
                for (var col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
            }
            this.setupPositionProbePattern(0, 0),
                this.setupPositionProbePattern(this.moduleCount - 7, 0),
                this.setupPositionProbePattern(0, this.moduleCount - 7),
                this.setupPositionAdjustPattern(), this.setupTimingPattern(),
                this.setupTypeInfo(test, maskPattern),
                this.typeNumber >= 7 && this.setupTypeNumber(test),
                this.dataCache == null && (this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList)), this.mapData(this.dataCache, maskPattern);
        },
        "setupPositionProbePattern": function(row, col) {
            for (var r = -1; r <= 7; r++) {
                if (row + r <= -1 || this.moduleCount <= row + r) continue;
                for (var c = -1; c <= 7; c++) {
                    if (col + c <= -1 || this.moduleCount <= col + c) continue;
                    0 <= r && r <= 6 && (c == 0 || c == 6) || 0 <= c && c <= 6 && (r == 0 || r == 6) || 2 <= r && r <= 4 && 2 <= c && c <= 4 ? this.modules[row + r][col + c] = !0 : this.modules[row + r][col + c] = !1;
                }
            }
        },
        "getBestMaskPattern": function() {
            var minLostPoint = 0,
                pattern = 0;
            for (var i = 0; i < 8; i++) {
                this.makeImpl(!0, i);
                var lostPoint = QRUtil.getLostPoint(this);
                if (i == 0 || minLostPoint > lostPoint) minLostPoint = lostPoint, pattern = i;
            }
            return pattern;
        },
        "createMovieClip": function(target_mc, instance_name, depth) {
            var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth),
                cs = 1;
            this.make();
            for (var row = 0; row < this.modules.length; row++) {
                var y = row * cs;
                for (var col = 0; col < this.modules[row].length; col++) {
                    var x = col * cs,
                        dark = this.modules[row][col];
                    dark && (qr_mc.beginFill(0, 100), qr_mc.moveTo(x, y), qr_mc.lineTo(x + cs, y), qr_mc.lineTo(x + cs, y + cs), qr_mc.lineTo(x, y + cs), qr_mc.endFill());
                }
            }
            return qr_mc;
        },
        "setupTimingPattern": function() {
            for (var r = 8; r < this.moduleCount - 8; r++) {
                if (this.modules[r][6] != null) continue;
                this.modules[r][6] = r % 2 == 0;
            }
            for (var c = 8; c < this.moduleCount - 8; c++) {
                if (this.modules[6][c] != null) continue;
                this.modules[6][c] = c % 2 == 0;
            }
        },
        "setupPositionAdjustPattern": function() {
            var pos = QRUtil.getPatternPosition(this.typeNumber);
            for (var i = 0; i < pos.length; i++)
                for (var j = 0; j < pos.length; j++) {
                    var row = pos[i],
                        col = pos[j];
                    if (this.modules[row][col] != null) continue;
                    for (var r = -2; r <= 2; r++)
                        for (var c = -2; c <= 2; c++) r == -2 || r == 2 || c == -2 || c == 2 || r == 0 && c == 0 ? this.modules[row + r][col + c] = !0 : this.modules[row + r][col + c] = !1;
                }
        },
        "setupTypeNumber": function(test) {
            var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
            for (var i = 0; i < 18; i++) {
                var mod = !test && (bits >> i & 1) == 1;
                this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
            }
            for (var i = 0; i < 18; i++) {
                var mod = !test && (bits >> i & 1) == 1;
                this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
            }
        },
        "setupTypeInfo": function(test, maskPattern) {
            var data = this.errorCorrectLevel << 3 | maskPattern,
                bits = QRUtil.getBCHTypeInfo(data);
            for (var i = 0; i < 15; i++) {
                var mod = !test && (bits >> i & 1) == 1;
                i < 6 ? this.modules[i][8] = mod : i < 8 ? this.modules[i + 1][8] = mod : this.modules[this.moduleCount - 15 + i][8] = mod;
            }
            for (var i = 0; i < 15; i++) {
                var mod = !test && (bits >> i & 1) == 1;
                i < 8 ? this.modules[8][this.moduleCount - i - 1] = mod : i < 9 ? this.modules[8][15 - i - 1 + 1] = mod : this.modules[8][15 - i - 1] = mod;
            }
            this.modules[this.moduleCount - 8][8] = !test;
        },
        "mapData": function(data, maskPattern) {
            var inc = -1,
                row = this.moduleCount - 1,
                bitIndex = 7,
                byteIndex = 0;
            for (var col = this.moduleCount - 1; col > 0; col -= 2) {
                col == 6 && col--;
                for (;;) {
                    for (var c = 0; c < 2; c++)
                        if (this.modules[row][col - c] == null) {
                            var dark = !1;
                            byteIndex < data.length && (dark = (data[byteIndex] >>> bitIndex & 1) == 1);
                            var mask = QRUtil.getMask(maskPattern, row, col - c);
                            mask && (dark = !dark), this.modules[row][col - c] = dark, bitIndex--, bitIndex == -1 && (byteIndex++, bitIndex = 7);
                        }
                    row += inc;
                    if (row < 0 || this.moduleCount <= row) {
                        row -= inc, inc = -inc;
                        break;
                    }
                }
            }
        }
    }, QRCodeModel.PAD0 = 236, QRCodeModel.PAD1 = 17, QRCodeModel.createData = function(typeNumber, errorCorrectLevel, dataList) {
        var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel),
            buffer = new QRBitBuffer;
        for (var i = 0; i < dataList.length; i++) {
            var data = dataList[i];
            buffer.put(data.mode, 4), buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber)), data.write(buffer);
        }
        var totalDataCount = 0;
        for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
        if (buffer.getLengthInBits() > totalDataCount * 8) throw new Error("code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")");
        buffer.getLengthInBits() + 4 <= totalDataCount * 8 && buffer.put(0, 4);
        while (buffer.getLengthInBits() % 8 != 0) buffer.putBit(!1);
        for (;;) {
            if (buffer.getLengthInBits() >= totalDataCount * 8) break;
            buffer.put(QRCodeModel.PAD0, 8);
            if (buffer.getLengthInBits() >= totalDataCount * 8) break;
            buffer.put(QRCodeModel.PAD1, 8);
        }
        return QRCodeModel.createBytes(buffer, rsBlocks);
    }, QRCodeModel.createBytes = function(buffer, rsBlocks) {
        var offset = 0,
            maxDcCount = 0,
            maxEcCount = 0,
            dcdata = new Array(rsBlocks.length),
            ecdata = new Array(rsBlocks.length);
        for (var r = 0; r < rsBlocks.length; r++) {
            var dcCount = rsBlocks[r].dataCount,
                ecCount = rsBlocks[r].totalCount - dcCount;
            maxDcCount = Math.max(maxDcCount, dcCount), maxEcCount = Math.max(maxEcCount, ecCount), dcdata[r] = new Array(dcCount);
            for (var i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 255 & buffer.buffer[i + offset];
            offset += dcCount;
            var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount),
                rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1),
                modPoly = rawPoly.mod(rsPoly);
            ecdata[r] = new Array(rsPoly.getLength() - 1);
            for (var i = 0; i < ecdata[r].length; i++) {
                var modIndex = i + modPoly.getLength() - ecdata[r].length;
                ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
            }
        }
        var totalCodeCount = 0;
        for (var i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
        var data = new Array(totalCodeCount),
            index = 0;
        for (var i = 0; i < maxDcCount; i++)
            for (var r = 0; r < rsBlocks.length; r++) i < dcdata[r].length && (data[index++] = dcdata[r][i]);
        for (var i = 0; i < maxEcCount; i++)
            for (var r = 0; r < rsBlocks.length; r++) i < ecdata[r].length && (data[index++] = ecdata[r][i]);
        return data;
    };

    var QRMode = {
            "MODE_NUMBER": 1,
            "MODE_ALPHA_NUM": 2,
            "MODE_8BIT_BYTE": 4,
            "MODE_KANJI": 8
        },
        QRErrorCorrectLevel = {
            "L": 1,
            "M": 0,
            "Q": 3,
            "H": 2
        },
        QRMaskPattern = {
            "PATTERN000": 0,
            "PATTERN001": 1,
            "PATTERN010": 2,
            "PATTERN011": 3,
            "PATTERN100": 4,
            "PATTERN101": 5,
            "PATTERN110": 6,
            "PATTERN111": 7
        },
        QRUtil = {
            "PATTERN_POSITION_TABLE": [
                [],
                [6, 18],
                [6, 22],
                [6, 26],
                [6, 30],
                [6, 34],
                [6, 22, 38],
                [6, 24, 42],
                [6, 26, 46],
                [6, 28, 50],
                [6, 30, 54],
                [6, 32, 58],
                [6, 34, 62],
                [6, 26, 46, 66],
                [6, 26, 48, 70],
                [6, 26, 50, 74],
                [6, 30, 54, 78],
                [6, 30, 56, 82],
                [6, 30, 58, 86],
                [6, 34, 62, 90],
                [6, 28, 50, 72, 94],
                [6, 26, 50, 74, 98],
                [6, 30, 54, 78, 102],
                [6, 28, 54, 80, 106],
                [6, 32, 58, 84, 110],
                [6, 30, 58, 86, 114],
                [6, 34, 62, 90, 118],
                [6, 26, 50, 74, 98, 122],
                [6, 30, 54, 78, 102, 126],
                [6, 26, 52, 78, 104, 130],
                [6, 30, 56, 82, 108, 134],
                [6, 34, 60, 86, 112, 138],
                [6, 30, 58, 86, 114, 142],
                [6, 34, 62, 90, 118, 146],
                [6, 30, 54, 78, 102, 126, 150],
                [6, 24, 50, 76, 102, 128, 154],
                [6, 28, 54, 80, 106, 132, 158],
                [6, 32, 58, 84, 110, 136, 162],
                [6, 26, 54, 82, 110, 138, 166],
                [6, 30, 58, 86, 114, 142, 170]
            ],
            "G15": 1335,
            "G18": 7973,
            "G15_MASK": 21522,
            "getBCHTypeInfo": function(data) {
                var d = data << 10;
                while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) d ^= QRUtil.G15 << QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15);
                return (data << 10 | d) ^ QRUtil.G15_MASK;
            },
            "getBCHTypeNumber": function(data) {
                var d = data << 12;
                while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) d ^= QRUtil.G18 << QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18);
                return data << 12 | d;
            },
            "getBCHDigit": function(data) {
                var digit = 0;
                while (data != 0) digit++, data >>>= 1;
                return digit;
            },
            "getPatternPosition": function(typeNumber) {
                return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
            },
            "getMask": function(maskPattern, i, j) {
                switch (maskPattern) {
                    case QRMaskPattern.PATTERN000:
                        return (i + j) % 2 == 0;
                    case QRMaskPattern.PATTERN001:
                        return i % 2 == 0;
                    case QRMaskPattern.PATTERN010:
                        return j % 3 == 0;
                    case QRMaskPattern.PATTERN011:
                        return (i + j) % 3 == 0;
                    case QRMaskPattern.PATTERN100:
                        return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
                    case QRMaskPattern.PATTERN101:
                        return i * j % 2 + i * j % 3 == 0;
                    case QRMaskPattern.PATTERN110:
                        return (i * j % 2 + i * j % 3) % 2 == 0;
                    case QRMaskPattern.PATTERN111:
                        return (i * j % 3 + (i + j) % 2) % 2 == 0;
                    default:
                        throw new Error("bad maskPattern:" + maskPattern);
                }
            },
            "getErrorCorrectPolynomial": function(errorCorrectLength) {
                var a = new QRPolynomial([1], 0);
                for (var i = 0; i < errorCorrectLength; i++) a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
                return a;
            },
            "getLengthInBits": function(mode, type) {
                if (1 <= type && type < 10) switch (mode) {
                    case QRMode.MODE_NUMBER:
                        return 10;
                    case QRMode.MODE_ALPHA_NUM:
                        return 9;
                    case QRMode.MODE_8BIT_BYTE:
                        return 8;
                    case QRMode.MODE_KANJI:
                        return 8;
                    default:
                        throw new Error("mode:" + mode);
                } else if (type < 27) switch (mode) {
                    case QRMode.MODE_NUMBER:
                        return 12;
                    case QRMode.MODE_ALPHA_NUM:
                        return 11;
                    case QRMode.MODE_8BIT_BYTE:
                        return 16;
                    case QRMode.MODE_KANJI:
                        return 10;
                    default:
                        throw new Error("mode:" + mode);
                } else {
                    if (!(type < 41)) throw new Error("type:" + type);
                    switch (mode) {
                        case QRMode.MODE_NUMBER:
                            return 14;
                        case QRMode.MODE_ALPHA_NUM:
                            return 13;
                        case QRMode.MODE_8BIT_BYTE:
                            return 16;
                        case QRMode.MODE_KANJI:
                            return 12;
                        default:
                            throw new Error("mode:" + mode);
                    }
                }
            },
            "getLostPoint": function(qrCode) {
                var moduleCount = qrCode.getModuleCount(),
                    lostPoint = 0;
                for (var row = 0; row < moduleCount; row++)
                    for (var col = 0; col < moduleCount; col++) {
                        var sameCount = 0,
                            dark = qrCode.isDark(row, col);
                        for (var r = -1; r <= 1; r++) {
                            if (row + r < 0 || moduleCount <= row + r) continue;
                            for (var c = -1; c <= 1; c++) {
                                if (col + c < 0 || moduleCount <= col + c) continue;
                                if (r == 0 && c == 0) continue;
                                dark == qrCode.isDark(row + r, col + c) && sameCount++;
                            }
                        }
                        sameCount > 5 && (lostPoint += 3 + sameCount - 5);
                    }
                for (var row = 0; row < moduleCount - 1; row++)
                    for (var col = 0; col < moduleCount - 1; col++) {
                        var count = 0;
                        qrCode.isDark(row, col) && count++, qrCode.isDark(row + 1, col) && count++, qrCode.isDark(row, col + 1) && count++, qrCode.isDark(row + 1, col + 1) && count++;
                        if (count == 0 || count == 4) lostPoint += 3;
                    }
                for (var row = 0; row < moduleCount; row++)
                    for (var col = 0; col < moduleCount - 6; col++) qrCode.isDark(row, col) && !qrCode.isDark(row, col + 1) && qrCode.isDark(row, col + 2) && qrCode.isDark(row, col + 3) && qrCode.isDark(row, col + 4) && !qrCode.isDark(row, col + 5) && qrCode.isDark(row, col + 6) && (lostPoint += 40);
                for (var col = 0; col < moduleCount; col++)
                    for (var row = 0; row < moduleCount - 6; row++) qrCode.isDark(row, col) && !qrCode.isDark(row + 1, col) && qrCode.isDark(row + 2, col) && qrCode.isDark(row + 3, col) && qrCode.isDark(row + 4, col) && !qrCode.isDark(row + 5, col) && qrCode.isDark(row + 6, col) && (lostPoint += 40);
                var darkCount = 0;
                for (var col = 0; col < moduleCount; col++)
                    for (var row = 0; row < moduleCount; row++) qrCode.isDark(row, col) && darkCount++;
                var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
                return lostPoint += ratio * 10, lostPoint;
            }
        },
        QRMath = {
            "glog": function(n) {
                if (n < 1) throw new Error("glog(" + n + ")");
                return QRMath.LOG_TABLE[n];
            },
            "gexp": function(n) {
                while (n < 0) n += 255;
                while (n >= 256) n -= 255;
                return QRMath.EXP_TABLE[n];
            },
            "EXP_TABLE": new Array(256),
            "LOG_TABLE": new Array(256)
        };

    for (var i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;

    for (var i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];

    for (var i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

    QRPolynomial.prototype = {
        "get": function(index) {
            return this.num[index];
        },
        "getLength": function() {
            return this.num.length;
        },
        "multiply": function(e) {
            var num = new Array(this.getLength() + e.getLength() - 1);
            for (var i = 0; i < this.getLength(); i++)
                for (var j = 0; j < e.getLength(); j++) num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
            return new QRPolynomial(num, 0);
        },
        "mod": function(e) {
            if (this.getLength() - e.getLength() < 0) return this;
            var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0)),
                num = new Array(this.getLength());
            for (var i = 0; i < this.getLength(); i++) num[i] = this.get(i);
            for (var i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
            return (new QRPolynomial(num, 0)).mod(e);
        }
    }, QRRSBlock.RS_BLOCK_TABLE = [
        [1, 26, 19],
        [1, 26, 16],
        [1, 26, 13],
        [1, 26, 9],
        [1, 44, 34],
        [1, 44, 28],
        [1, 44, 22],
        [1, 44, 16],
        [1, 70, 55],
        [1, 70, 44],
        [2, 35, 17],
        [2, 35, 13],
        [1, 100, 80],
        [2, 50, 32],
        [2, 50, 24],
        [4, 25, 9],
        [1, 134, 108],
        [2, 67, 43],
        [2, 33, 15, 2, 34, 16],
        [2, 33, 11, 2, 34, 12],
        [2, 86, 68],
        [4, 43, 27],
        [4, 43, 19],
        [4, 43, 15],
        [2, 98, 78],
        [4, 49, 31],
        [2, 32, 14, 4, 33, 15],
        [4, 39, 13, 1, 40, 14],
        [2, 121, 97],
        [2, 60, 38, 2, 61, 39],
        [4, 40, 18, 2, 41, 19],
        [4, 40, 14, 2, 41, 15],
        [2, 146, 116],
        [3, 58, 36, 2, 59, 37],
        [4, 36, 16, 4, 37, 17],
        [4, 36, 12, 4, 37, 13],
        [2, 86, 68, 2, 87, 69],
        [4, 69, 43, 1, 70, 44],
        [6, 43, 19, 2, 44, 20],
        [6, 43, 15, 2, 44, 16],
        [4, 101, 81],
        [1, 80, 50, 4, 81, 51],
        [4, 50, 22, 4, 51, 23],
        [3, 36, 12, 8, 37, 13],
        [2, 116, 92, 2, 117, 93],
        [6, 58, 36, 2, 59, 37],
        [4, 46, 20, 6, 47, 21],
        [7, 42, 14, 4, 43, 15],
        [4, 133, 107],
        [8, 59, 37, 1, 60, 38],
        [8, 44, 20, 4, 45, 21],
        [12, 33, 11, 4, 34, 12],
        [3, 145, 115, 1, 146, 116],
        [4, 64, 40, 5, 65, 41],
        [11, 36, 16, 5, 37, 17],
        [11, 36, 12, 5, 37, 13],
        [5, 109, 87, 1, 110, 88],
        [5, 65, 41, 5, 66, 42],
        [5, 54, 24, 7, 55, 25],
        [11, 36, 12],
        [5, 122, 98, 1, 123, 99],
        [7, 73, 45, 3, 74, 46],
        [15, 43, 19, 2, 44, 20],
        [3, 45, 15, 13, 46, 16],
        [1, 135, 107, 5, 136, 108],
        [10, 74, 46, 1, 75, 47],
        [1, 50, 22, 15, 51, 23],
        [2, 42, 14, 17, 43, 15],
        [5, 150, 120, 1, 151, 121],
        [9, 69, 43, 4, 70, 44],
        [17, 50, 22, 1, 51, 23],
        [2, 42, 14, 19, 43, 15],
        [3, 141, 113, 4, 142, 114],
        [3, 70, 44, 11, 71, 45],
        [17, 47, 21, 4, 48, 22],
        [9, 39, 13, 16, 40, 14],
        [3, 135, 107, 5, 136, 108],
        [3, 67, 41, 13, 68, 42],
        [15, 54, 24, 5, 55, 25],
        [15, 43, 15, 10, 44, 16],
        [4, 144, 116, 4, 145, 117],
        [17, 68, 42],
        [17, 50, 22, 6, 51, 23],
        [19, 46, 16, 6, 47, 17],
        [2, 139, 111, 7, 140, 112],
        [17, 74, 46],
        [7, 54, 24, 16, 55, 25],
        [34, 37, 13],
        [4, 151, 121, 5, 152, 122],
        [4, 75, 47, 14, 76, 48],
        [11, 54, 24, 14, 55, 25],
        [16, 45, 15, 14, 46, 16],
        [6, 147, 117, 4, 148, 118],
        [6, 73, 45, 14, 74, 46],
        [11, 54, 24, 16, 55, 25],
        [30, 46, 16, 2, 47, 17],
        [8, 132, 106, 4, 133, 107],
        [8, 75, 47, 13, 76, 48],
        [7, 54, 24, 22, 55, 25],
        [22, 45, 15, 13, 46, 16],
        [10, 142, 114, 2, 143, 115],
        [19, 74, 46, 4, 75, 47],
        [28, 50, 22, 6, 51, 23],
        [33, 46, 16, 4, 47, 17],
        [8, 152, 122, 4, 153, 123],
        [22, 73, 45, 3, 74, 46],
        [8, 53, 23, 26, 54, 24],
        [12, 45, 15, 28, 46, 16],
        [3, 147, 117, 10, 148, 118],
        [3, 73, 45, 23, 74, 46],
        [4, 54, 24, 31, 55, 25],
        [11, 45, 15, 31, 46, 16],
        [7, 146, 116, 7, 147, 117],
        [21, 73, 45, 7, 74, 46],
        [1, 53, 23, 37, 54, 24],
        [19, 45, 15, 26, 46, 16],
        [5, 145, 115, 10, 146, 116],
        [19, 75, 47, 10, 76, 48],
        [15, 54, 24, 25, 55, 25],
        [23, 45, 15, 25, 46, 16],
        [13, 145, 115, 3, 146, 116],
        [2, 74, 46, 29, 75, 47],
        [42, 54, 24, 1, 55, 25],
        [23, 45, 15, 28, 46, 16],
        [17, 145, 115],
        [10, 74, 46, 23, 75, 47],
        [10, 54, 24, 35, 55, 25],
        [19, 45, 15, 35, 46, 16],
        [17, 145, 115, 1, 146, 116],
        [14, 74, 46, 21, 75, 47],
        [29, 54, 24, 19, 55, 25],
        [11, 45, 15, 46, 46, 16],
        [13, 145, 115, 6, 146, 116],
        [14, 74, 46, 23, 75, 47],
        [44, 54, 24, 7, 55, 25],
        [59, 46, 16, 1, 47, 17],
        [12, 151, 121, 7, 152, 122],
        [12, 75, 47, 26, 76, 48],
        [39, 54, 24, 14, 55, 25],
        [22, 45, 15, 41, 46, 16],
        [6, 151, 121, 14, 152, 122],
        [6, 75, 47, 34, 76, 48],
        [46, 54, 24, 10, 55, 25],
        [2, 45, 15, 64, 46, 16],
        [17, 152, 122, 4, 153, 123],
        [29, 74, 46, 14, 75, 47],
        [49, 54, 24, 10, 55, 25],
        [24, 45, 15, 46, 46, 16],
        [4, 152, 122, 18, 153, 123],
        [13, 74, 46, 32, 75, 47],
        [48, 54, 24, 14, 55, 25],
        [42, 45, 15, 32, 46, 16],
        [20, 147, 117, 4, 148, 118],
        [40, 75, 47, 7, 76, 48],
        [43, 54, 24, 22, 55, 25],
        [10, 45, 15, 67, 46, 16],
        [19, 148, 118, 6, 149, 119],
        [18, 75, 47, 31, 76, 48],
        [34, 54, 24, 34, 55, 25],
        [20, 45, 15, 61, 46, 16]
    ], QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
        var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
        if (rsBlock == undefined) throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
        var length = rsBlock.length / 3,
            list = [];
        for (var i = 0; i < length; i++) {
            var count = rsBlock[i * 3 + 0],
                totalCount = rsBlock[i * 3 + 1],
                dataCount = rsBlock[i * 3 + 2];
            for (var j = 0; j < count; j++) list.push(new QRRSBlock(totalCount, dataCount));
        }
        return list;
    }, QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {
        switch (errorCorrectLevel) {
            case QRErrorCorrectLevel.L:
                return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
            case QRErrorCorrectLevel.M:
                return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
            case QRErrorCorrectLevel.Q:
                return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
            case QRErrorCorrectLevel.H:
                return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
            default:
                return undefined;
        }
    }, QRBitBuffer.prototype = {
        "get": function(index) {
            var bufIndex = Math.floor(index / 8);
            return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) == 1;
        },
        "put": function(num, length) {
            for (var i = 0; i < length; i++) this.putBit((num >>> length - i - 1 & 1) == 1);
        },
        "getLengthInBits": function() {
            return this.length;
        },
        "putBit": function(bit) {
            var bufIndex = Math.floor(this.length / 8);
            this.buffer.length <= bufIndex && this.buffer.push(0), bit && (this.buffer[bufIndex] |= 128 >>> this.length % 8), this.length++;
        }
    };
    var QRCodeLimitLength = [
        [17, 14, 11, 7],
        [32, 26, 20, 14],
        [53, 42, 32, 24],
        [78, 62, 46, 34],
        [106, 84, 60, 44],
        [134, 106, 74, 58],
        [154, 122, 86, 64],
        [192, 152, 108, 84],
        [230, 180, 130, 98],
        [271, 213, 151, 119],
        [321, 251, 177, 137],
        [367, 287, 203, 155],
        [425, 331, 241, 177],
        [458, 362, 258, 194],
        [520, 412, 292, 220],
        [586, 450, 322, 250],
        [644, 504, 364, 280],
        [718, 560, 394, 310],
        [792, 624, 442, 338],
        [858, 666, 482, 382],
        [929, 711, 509, 403],
        [1003, 779, 565, 439],
        [1091, 857, 611, 461],
        [1171, 911, 661, 511],
        [1273, 997, 715, 535],
        [1367, 1059, 751, 593],
        [1465, 1125, 805, 625],
        [1528, 1190, 868, 658],
        [1628, 1264, 908, 698],
        [1732, 1370, 982, 742],
        [1840, 1452, 1030, 790],
        [1952, 1538, 1112, 842],
        [2068, 1628, 1168, 898],
        [2188, 1722, 1228, 958],
        [2303, 1809, 1283, 983],
        [2431, 1911, 1351, 1051],
        [2563, 1989, 1423, 1093],
        [2699, 2099, 1499, 1139],
        [2809, 2213, 1579, 1219],
        [2953, 2331, 1663, 1273]
    ];

    function _isSupportCanvas() {
        return typeof CanvasRenderingContext2D != "undefined";
    }

    // android 2.x doesn't support Data-URI spec
    function _getAndroid() {
        var android = false;
        var sAgent = navigator.userAgent;

        if (/android/i.test(sAgent)) { // android
            android = true;
            aMat = sAgent.toString().match(/android ([0-9]\.[0-9])/i);

            if (aMat && aMat[1]) {
                android = parseFloat(aMat[1]);
            }
        }

        return android;
    }

    var svgDrawer = (function() {

        var Drawing = function(el, htOption) {
            this._el = el;
            this._htOption = htOption;
        };

        Drawing.prototype.draw = function(oQRCode) {
            var _htOption = this._htOption;
            var _el = this._el;
            var nCount = oQRCode.getModuleCount();
            var nWidth = Math.floor(_htOption.width / nCount);
            var nHeight = Math.floor(_htOption.height / nCount);

            this.clear();

            function makeSVG(tag, attrs) {
                var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
                for (var k in attrs)
                    if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
                return el;
            }

            var svg = makeSVG("svg", {
                'viewBox': '0 0 ' + String(nCount) + " " + String(nCount),
                'width': '100%',
                'height': '100%',
                'fill': _htOption.colorLight
            });
            svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
            _el.appendChild(svg);

            svg.appendChild(makeSVG("rect", {
                "fill": _htOption.colorDark,
                "width": "1",
                "height": "1",
                "id": "template"
            }));

            for (var row = 0; row < nCount; row++) {
                for (var col = 0; col < nCount; col++) {
                    if (oQRCode.isDark(row, col)) {
                        var child = makeSVG("use", {
                            "x": String(row),
                            "y": String(col)
                        });
                        child.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#template")
                        svg.appendChild(child);
                    }
                }
            }
        };
        Drawing.prototype.clear = function() {
            while (this._el.hasChildNodes())
                this._el.removeChild(this._el.lastChild);
        };
        return Drawing;
    })();

    var useSVG = document.documentElement.tagName.toLowerCase() === "svg";

    // Drawing in DOM by using Table tag
    var Drawing = useSVG ? svgDrawer : !_isSupportCanvas() ? (function() {
        var Drawing = function(el, htOption) {
            this._el = el;
            this._htOption = htOption;
        };

        /**
         * Draw the QRCode
         * 
         * @param {QRCode} oQRCode
         */
        Drawing.prototype.draw = function(oQRCode) {
            var _htOption = this._htOption;
            var _el = this._el;
            var nCount = oQRCode.getModuleCount();
            var nWidth = Math.floor(_htOption.width / nCount);
            var nHeight = Math.floor(_htOption.height / nCount);
            var aHTML = ['<table style="border:0;border-collapse:collapse;">'];

            for (var row = 0; row < nCount; row++) {
                aHTML.push('<tr>');

                for (var col = 0; col < nCount; col++) {
                    aHTML.push('<td style="border:0;border-collapse:collapse;padding:0;margin:0;width:' + nWidth + 'px;height:' + nHeight + 'px;background-color:' + (oQRCode.isDark(row, col) ? _htOption.colorDark : _htOption.colorLight) + ';"></td>');
                }

                aHTML.push('</tr>');
            }

            aHTML.push('</table>');
            _el.innerHTML = aHTML.join('');

            // Fix the margin values as real size.
            var elTable = _el.childNodes[0];
            var nLeftMarginTable = (_htOption.width - elTable.offsetWidth) / 2;
            var nTopMarginTable = (_htOption.height - elTable.offsetHeight) / 2;
            if (nLeftMarginTable > 0 && nTopMarginTable > 0) {
                elTable.style.margin = nTopMarginTable + "px " + nLeftMarginTable + "px";
            }
        };

        /**
         * Clear the QRCode
         */
        Drawing.prototype.clear = function() {
            this._el.innerHTML = '';
        };

        return Drawing;
    })() : (function() { // Drawing in Canvas
        function _onMakeImage() {
            this._elImage.src = this._elCanvas.toDataURL("image/png");
            this._elImage.style.display = "inline-block";
            this._elCanvas.style.display = "none";
        }

        // Android 2.1 bug workaround
        // http://code.google.com/p/android/issues/detail?id=5141
        if (this._android && this._android <= 2.1) {
            var factor = 1 / window.devicePixelRatio;
            var drawImage = CanvasRenderingContext2D.prototype.drawImage;
            CanvasRenderingContext2D.prototype.drawImage = function(image, sx, sy, sw, sh, dx, dy, dw, dh) {
                if (("nodeName" in image) && /img/i.test(image.nodeName)) {
                    for (var i = arguments.length - 1; i >= 1; i--) {
                        arguments[i] = arguments[i] * factor;
                    }
                } else if (typeof dw == "undefined") {
                    arguments[1] *= factor;
                    arguments[2] *= factor;
                    arguments[3] *= factor;
                    arguments[4] *= factor;
                }

                drawImage.apply(this, arguments);
            };
        }

        /**
         * Check whether the user's browser supports Data URI or not
         * 
         * @private
         * @param {Function} fSuccess Occurs if it supports Data URI
         * @param {Function} fFail Occurs if it doesn't support Data URI
         */
        function _safeSetDataURI(fSuccess, fFail) {
            var self = this;
            self._fFail = fFail;
            self._fSuccess = fSuccess;

            // Check it just once
            if (self._bSupportDataURI === null) {
                var el = document.createElement("img");
                var fOnError = function() {
                    self._bSupportDataURI = false;

                    if (self._fFail) {
                        _fFail.call(self);
                    }
                };
                var fOnSuccess = function() {
                    self._bSupportDataURI = true;

                    if (self._fSuccess) {
                        self._fSuccess.call(self);
                    }
                };

                el.onabort = fOnError;
                el.onerror = fOnError;
                el.onload = fOnSuccess;
                el.src = "data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="; // the Image contains 1px data.
                return;
            } else if (self._bSupportDataURI === true && self._fSuccess) {
                self._fSuccess.call(self);
            } else if (self._bSupportDataURI === false && self._fFail) {
                self._fFail.call(self);
            }
        };

        /**
         * Drawing QRCode by using canvas
         * 
         * @constructor
         * @param {HTMLElement} el
         * @param {Object} htOption QRCode Options 
         */
        var Drawing = function(el, htOption) {
            this._bIsPainted = false;
            this._android = _getAndroid();

            this._htOption = htOption;
            this._elCanvas = document.createElement("canvas");
            this._elCanvas.width = htOption.width;
            this._elCanvas.height = htOption.height;
            el.appendChild(this._elCanvas);
            this._el = el;
            this._oContext = this._elCanvas.getContext("2d");
            this._bIsPainted = false;
            this._elImage = document.createElement("img");
            this._elImage.alt = "Scan me!";
            this._elImage.style.display = "none";
            this._el.appendChild(this._elImage);
            this._bSupportDataURI = null;
        };

        /**
         * Draw the QRCode
         * 
         * @param {QRCode} oQRCode 
         */
        Drawing.prototype.draw = function(oQRCode) {
            var _elImage = this._elImage;
            var _oContext = this._oContext;
            var _htOption = this._htOption;

            var nCount = oQRCode.getModuleCount();
            var nWidth = _htOption.width / nCount;
            var nHeight = _htOption.height / nCount;
            var nRoundedWidth = Math.round(nWidth);
            var nRoundedHeight = Math.round(nHeight);

            _elImage.style.display = "none";
            this.clear();

            for (var row = 0; row < nCount; row++) {
                for (var col = 0; col < nCount; col++) {
                    var bIsDark = oQRCode.isDark(row, col);
                    var nLeft = col * nWidth;
                    var nTop = row * nHeight;
                    _oContext.strokeStyle = bIsDark ? _htOption.colorDark : _htOption.colorLight;
                    _oContext.lineWidth = 1;
                    _oContext.fillStyle = bIsDark ? _htOption.colorDark : _htOption.colorLight;
                    _oContext.fillRect(nLeft, nTop, nWidth, nHeight);

                    // 안티 앨리어싱 방지 처리
                    _oContext.strokeRect(
                        Math.floor(nLeft) + 0.5,
                        Math.floor(nTop) + 0.5,
                        nRoundedWidth,
                        nRoundedHeight
                    );

                    _oContext.strokeRect(
                        Math.ceil(nLeft) - 0.5,
                        Math.ceil(nTop) - 0.5,
                        nRoundedWidth,
                        nRoundedHeight
                    );
                }
            }

            this._bIsPainted = true;
        };

        /**
         * Make the image from Canvas if the browser supports Data URI.
         */
        Drawing.prototype.makeImage = function() {
            if (this._bIsPainted) {
                _safeSetDataURI.call(this, _onMakeImage);
            }
        };

        /**
         * Return whether the QRCode is painted or not
         * 
         * @return {Boolean}
         */
        Drawing.prototype.isPainted = function() {
            return this._bIsPainted;
        };

        /**
         * Clear the QRCode
         */
        Drawing.prototype.clear = function() {
            this._oContext.clearRect(0, 0, this._elCanvas.width, this._elCanvas.height);
            this._bIsPainted = false;
        };

        /**
         * @private
         * @param {Number} nNumber
         */
        Drawing.prototype.round = function(nNumber) {
            if (!nNumber) {
                return nNumber;
            }

            return Math.floor(nNumber * 1000) / 1000;
        };

        return Drawing;
    })();

    /**
     * Get the type by string length
     * 
     * @private
     * @param {String} sText
     * @param {Number} nCorrectLevel
     * @return {Number} type
     */
    function _getTypeNumber(sText, nCorrectLevel) {
        var nType = 1;
        var length = _getUTF8Length(sText);

        for (var i = 0, len = QRCodeLimitLength.length; i <= len; i++) {
            var nLimit = 0;

            switch (nCorrectLevel) {
                case QRErrorCorrectLevel.L:
                    nLimit = QRCodeLimitLength[i][0];
                    break;
                case QRErrorCorrectLevel.M:
                    nLimit = QRCodeLimitLength[i][1];
                    break;
                case QRErrorCorrectLevel.Q:
                    nLimit = QRCodeLimitLength[i][2];
                    break;
                case QRErrorCorrectLevel.H:
                    nLimit = QRCodeLimitLength[i][3];
                    break;
            }

            if (length <= nLimit) {
                break;
            } else {
                nType++;
            }
        }

        if (nType > QRCodeLimitLength.length) {
            throw new Error("Too long data");
        }

        return nType;
    }

    function _getUTF8Length(sText) {
        var replacedText = encodeURI(sText).toString().replace(/\%[0-9a-fA-F]{2}/g, 'a');
        return replacedText.length + (replacedText.length != sText ? 3 : 0);
    }

    /**
     * @class QRCode
     * @constructor
     * @example 
     * new QRCode(document.getElementById("test"), "http://jindo.dev.naver.com/collie");
     *
     * @example
     * var oQRCode = new QRCode("test", {
     *    text : "http://naver.com",
     *    width : 128,
     *    height : 128
     * });
     * 
     * oQRCode.clear(); // Clear the QRCode.
     * oQRCode.makeCode("http://map.naver.com"); // Re-create the QRCode.
     *
     * @param {HTMLElement|String} el target element or 'id' attribute of element.
     * @param {Object|String} vOption
     * @param {String} vOption.text QRCode link data
     * @param {Number} [vOption.width=256]
     * @param {Number} [vOption.height=256]
     * @param {String} [vOption.colorDark="#000000"]
     * @param {String} [vOption.colorLight="#ffffff"]
     * @param {QRCode.CorrectLevel} [vOption.correctLevel=QRCode.CorrectLevel.H] [L|M|Q|H] 
     */
    QRCode = function(el, vOption) {
        this._htOption = {
            width: 256,
            height: 256,
            typeNumber: 4,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRErrorCorrectLevel.H
        };

        if (typeof vOption === 'string') {
            vOption = {
                text: vOption
            };
        }

        // Overwrites options
        if (vOption) {
            for (var i in vOption) {
                this._htOption[i] = vOption[i];
            }
        }

        if (typeof el == "string") {
            el = document.getElementById(el);
        }

        this._android = _getAndroid();
        this._el = el;
        this._oQRCode = null;
        this._oDrawing = new Drawing(this._el, this._htOption);

        if (this._htOption.text) {
            this.makeCode(this._htOption.text);
        }
    };

    /**
     * Make the QRCode
     * 
     * @param {String} sText link data
     */
    QRCode.prototype.makeCode = function(sText) {
        this._oQRCode = new QRCodeModel(_getTypeNumber(sText, this._htOption.correctLevel), this._htOption.correctLevel);
        this._oQRCode.addData(sText);
        this._oQRCode.make();
        this._el.title = sText;
        this._oDrawing.draw(this._oQRCode);
        this.makeImage();
    };

    /**
     * Make the Image from Canvas element
     * - It occurs automatically
     * - Android below 3 doesn't support Data-URI spec.
     * 
     * @private
     */
    QRCode.prototype.makeImage = function() {
        if (typeof this._oDrawing.makeImage == "function" && (!this._android || this._android >= 3)) {
            this._oDrawing.makeImage();
        }
    };

    /**
     * Clear the QRCode
     */
    QRCode.prototype.clear = function() {
        this._oDrawing.clear();
    };

    /**
     * @name QRCode.CorrectLevel
     */
    QRCode.CorrectLevel = QRErrorCorrectLevel;
})();



(function() { //生成二维码
    var href = document.scripts[document.scripts.length - 1].src.match(/\/\/([^\:\/\\]+)\:?(\d+)?/),
        ip = '127.0.0.1',
        port = '8131';
    if (href) {
        ip = href[1];
        port = href[2] || port;
    }

    function makeImg(qrcodeEl) {
        var qrcode = new QRCode(qrcodeEl, {
            width: 300, //设置宽高
            height: 300
        });
        qrcode.makeCode(top.location.href.replace('127.0.0.1', ip));
    }

    function makeQRImg() {
        var qrcodeEl = document.getElementById('__web-debug-QRCode');
        if (qrcodeEl) {
            if (qrcodeEl.style.display === 'block') {
                qrcodeEl.style.display = 'none';
            } else {
                qrcodeEl.style.display = 'block';
            }
            return;
        }
        qrcodeEl = document.createElement('div');
        qrcodeEl.id = '__web-debug-QRCode';
        qrcodeEl.style.cssText = 'display: block;z-index: 10000000;position: fixed;top: 0; left: 0;width: 100%;height: 100%; box-sizing:border-box; padding: 10px; text-aligin: center;';
        document.getElementsByTagName('body')[0].appendChild(qrcodeEl);
        makeImg(qrcodeEl);
    }

    window.addEventListener('keyup', function(e) {
        if (e.keyCode === 90 && e.shiftKey && e.ctrlKey) { //ctrl + shift + z
            makeQRImg();
        }
    }, false);

    function addDebugGap() {
        if (/(Mobile|Android|iPhone)/i.test(navigator.userAgent)) {
            var script = document.createElement('script');
            script.src = 'http://' + ip + ':' + port + '/debuggap.min.js';
            document.getElementsByTagName('body')[0].appendChild(script);
            localStorage.setItem('host', ip);
            localStorage.setItem('port', 11111);
        }
    }
    addDebugGap();
})();
