/*
 *  FSTransport.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-03-07
 *
 *  Copyright [2013-2015] [David P. Janes]
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use strict";

var iotdb = require('iotdb');
var _ = iotdb._;
var bunyan = iotdb.bunyan;

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var watch = require('watch');

var util = require('util');
var url = require('url');

var logger = bunyan.createLogger({
    name: 'iotdb-transport-fs',
    module: 'FSTransport',
});

/* --- forward definitions --- */
var _encode;
var _decode;
var _unpack;
var _pack;

/* --- constructor --- */

/**
 *  File System based Transport
 *  <p>
 *  See {iotdb.transporter.Transport#Transport} for documentation.
 */
var FSTransport = function (initd) {
    var self = this;

    self.initd = _.defaults(
        initd, {
            channel: iotdb.transporter.channel,
            unchannel: iotdb.transporter.unchannel,
            encode: _encode,
            decode: _decode,
            pack: _pack,
            unpack: _unpack,
        },
        iotdb.keystore().get("/transports/FSTransport/initd"), {
            prefix: path.join(process.cwd(), ".iotdb", "fs"),
            flat_band: null,
        }
    );

    /* for consistency but not used */
    self.native = {};

    /* ignore errors - they will occur later anyway */
    mkdirp.sync(self.initd.prefix, function (error) {});
};

FSTransport.prototype = new iotdb.transporter.Transport();

/* --- methods --- */

/**
 *  See {iotdb.transporter.Transport#list} for documentation.
 */
FSTransport.prototype.list = function (paramd, callback) {
    var self = this;

    if (arguments.length === 1) {
        paramd = {};
        callback = arguments[0];
    }

    self._validate_list(paramd, callback);

    fs.readdir(self.initd.prefix, function (error, names) {
        if (error) {
            return;
        }

        var _pop = function () {
            if (names.length === 0) {
                callback({
                    end: true,
                });
                return;
            }

            var name = names.pop();
            var folder = path.join(self.initd.prefix, name);

            var result = self.initd.unchannel(self.initd, folder);
            if (result) {
                if (callback({
                        id: result[0],
                    })) {
                    names = [];
                }

                _pop();
            }
        };

        _pop();
    });
};

/**
 *  See {iotdb.transporter.Transport#added} for documentation.
 *  <p>
 *  NOT FINISHED
 */
FSTransport.prototype.added = function (paramd, callback) {
    var self = this;

    if (arguments.length === 1) {
        paramd = {};
        callback = arguments[0];
    }

    self._validate_added(paramd, callback);
};

/**
 *  See {iotdb.transporter.Transport#about} for documentation.
 */
FSTransport.prototype.about = function (paramd, callback) {
    var self = this;

    self._validate_about(paramd, callback);

    if (self.initd.flat_band) {
        self._about_flat(paramd, callback);
    } else {
        self._about_normal(paramd, callback);
    }
};

/**
 *  Flat files - read and if it exists return [ id, flat_band ]
 */
FSTransport.prototype._about_flat = function (paramd, callback) {
    var self = this;
    var channel = self.initd.channel(self.initd, paramd.id);

    fs.readFile(channel, {
        encoding: 'utf8'
    }, function (error, doc) {
        if (error) {
            return callback({
                id: paramd.id,
                bands: null,
                error: error,
            });
        }

        return callback({
            id: paramd.id,
            bands: [self.initd.flat_band, ],
        });
    });
};

/**
 */
FSTransport.prototype._about_normal = function (paramd, callback) {
    var self = this;
    var channel = self.initd.channel(self.initd, paramd.id);
    var bands = [];

    fs.readdir(channel, function (error, names) {
        if (error) {
            return;
        }

        var _pop = function () {
            if (names.length === 0) {
                callback({
                    id: paramd.id,
                    bands: bands,
                });
                return;
            }

            var name = names.pop();
            var folder = path.join(channel, name);
            var result = self.initd.unchannel(self.initd, folder);
            if (!result) {
                _pop();
                return;
            }

            fs.readFile(folder, {
                encoding: 'utf8'
            }, function (error, doc) {
                if (!error) {
                    bands.push(name);
                }

                _pop();
            });
        };

        _pop();
    });
};

/**
 *  See {iotdb.transporter.Transport#get} for documentation.
 */
FSTransport.prototype.get = function (paramd, callback) {
    var self = this;

    self._validate_get(paramd, callback);

    var channel = self.initd.channel(self.initd, paramd.id, paramd.band);

    /* undefined for "don't know"; null for "doesn't exist" */
    fs.readFile(channel, {
        encoding: 'utf8'
    }, function (error, doc) {
        if (error) {
            callback({
                id: paramd.id,
                band: paramd.band,
                value: null,
                error: error,
            });
            return;
        }

        try {
            callback({
                id: paramd.id,
                band: paramd.band,
                value: self.initd.unpack(JSON.parse(doc), paramd.id, paramd.band),
            });
        } catch (x) {
            logger.error({
                method: "get",
                cause: "see stack trace",
                stack: x.stack,
            }, "exception in callback");
        }
    });
};

/**
 *  See {iotdb.transporter.Transport#update} for documentation.
 */
FSTransport.prototype.update = function (paramd, callback) {
    var self = this;

    self._validate_update(paramd, callback);

    var channel = self.initd.channel(self.initd, paramd.id, paramd.band);
    var d = self.initd.pack(paramd.value, paramd.id, paramd.band);

    mkdirp(path.dirname(channel), function (error) {
        if (error) {
            if (callback) {
                callback({
                    error: error
                });
            }
            return;
        }

        fs.writeFileSync(channel, JSON.stringify(d, null, 2));

        if (callback) {
            callback(null);
        }
    });
};

/**
 *  See {iotdb.transporter.Transport#updated} for documentation.
 */
FSTransport.prototype.updated = function (paramd, callback) {
    var self = this;

    if (arguments.length === 1) {
        paramd = {};
        callback = arguments[0];
    }

    self._validate_updated(paramd, callback);

    var last_time = 0;
    var last_id = null;
    var last_band = null;

    var _doit = function (f) {
        var result = self.initd.unchannel(self.initd, f);
        if (!result) {
            return;
        }

        var this_id = result[0];
        var this_band = result[1];

        if (paramd.id && (this_id !== paramd.id)) {
            return;
        }

        if (paramd.band && (this_band !== paramd.band)) {
            return;
        }

        /* debounce, sigh */
        var now = (new Date()).getTime();
        if ((this_id === last_id) && (this_band === last_band) && ((now - last_time) < 50)) {
            return;
        }

        last_id = this_id;
        last_band = this_band;
        last_time = now;

        callback({
            id: this_id,
            band: this_band,
            value: undefined,
        });
    };

    watch.createMonitor(self.initd.prefix, function (monitor) {
        monitor.on("created", function (f, stat) {
            _doit(f);
        });
        monitor.on("changed", function (f, curr, prev) {
            _doit(f);
        });
        monitor.on("removed", function (f, stat) {
            _doit(f);
        });
    });
};

/**
 *  See {iotdb.transporter.Transport#remove} for documentation.
 */
FSTransport.prototype.remove = function (paramd, callback) {
    var self = this;

    self._validate_remove(paramd, callback);

    var channel = self.initd.channel(self.initd, paramd.id);

    fs.readdir(channel, function (error, names) {
        if (error) {
            return;
        }

        var _pop = function () {
            if (names.length === 0) {
                fs.rmdir(channel, function (error) {});
            }

            var name = names.pop();
            var folder = path.join(channel, name);

            fs.unlink(folder, function (error) {
                _pop();
            });
        };

        _pop();
    });
};

/* --- internals --- */

var safe_rex = /[\/$%#\]\[]/g;
if (/^win/.test(process.platform)) {
    safe_rex = /[:\/$%#\]\[]/g;
}

var _encode = function (s) {
    return s.replace(safe_rex, function (c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
};

var _decode = function (s) {
    return decodeURIComponent(s);
};

var _unpack = function (d, id, band) {
    return _.d.transform(d, {
        pre: _.ld_compact,
        key: _decode,
    });
};

var _pack = function (d, id, band) {
    return _.d.transform(d, {
        pre: _.ld_compact,
        key: _encode,
    });
};

/**
 *  API
 */
exports.FSTransport = FSTransport;
