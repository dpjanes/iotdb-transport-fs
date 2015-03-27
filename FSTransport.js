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

/**
 *  Create a transport for FireBase.
 */
var FSTransport = function (initd) {
    var self = this;

    self.initd = _.defaults(
        initd,
        iotdb.keystore().get("/transports/FSTransport/initd"),
        {
            prefix: path.join(process.cwd(), ".iotdb", "fs"),
        }
    );
    
    self.native = self.initd.prefix;

    /* ignore errors - they will occur later anyway */
    mkdirp.sync(self.native, function(error) {
    });
};

/**
 *  List all the IDs associated with this Transport.
 *
 *  The callback is called with a list of IDs
 *  and then null when there are no further values.
 *
 *  Note that this may not be memory efficient due
 *  to the way "value" works. This could be revisited
 *  in the future.
 */
FSTransport.prototype.list = function(paramd, callback) {
    var self = this;

    if (arguments.length === 1) {
        paramd = {};
        callback = arguments[0];
    }

    fs.readdir(self.native, function(error, names) {
        if (error) {
            return;
        }

        var _pop = function() {
            if (names.length === 0) {
                return callback(null);
            }

            var name = names.pop();
            var path = fs.join(self.native, name);

            fs.stat(path, function(error, stbuf) {
                if (error) {
                } else if (stbuf.isDirectory()) {
                    callback([ path ]);
                } else {
                }

                _pop();
            });
        };

        _pop();
    });
};

/**
 */
FSTransport.prototype.get = function(id, band, callback) {
    var self = this;

    if (!id) {
        throw new Error("id is required");
    }
    if (!band) {
        throw new Error("band is required");
    }

    var channel = self._channel(id, band);

    /* undefined for "don't know"; null for "doesn't exist" */
    fs.readFile(channel, {
        encoding: 'utf8'
    }, function(error, doc) {
        if (error) {
            callback(id, band, null);
        }

        try {
            callback(id, band, JSON.parse(doc));
        }
        catch (x) {
            callback(id, band, null);
        }
    });
};

/**
 */
FSTransport.prototype.update = function(id, band, value) {
    var self = this;

    if (!id) {
        throw new Error("id is required");
    }
    if (!band) {
        throw new Error("band is required");
    }

    var channel = self._channel(id, band, { mkdirs: true });
    var d = _pack(value);

    /* this makes it an atomic write */
    var fake_channel = self._channel(id, "." + band);
    fs.writeFileSync(fake_channel, JSON.stringify(d, null, 2));
    fs.rename(fake_channel, channel);
};

/**
 */
FSTransport.prototype.updated = function(id, band, callback) {
    var self = this;

    if (arguments.length === 1) {
        id = null;
        band = null;
        callback = arguments[0];
    } else if (arguments.length === 2) {
        band = null;
        callback = arguments[1];
    }

    var last_time = 0;
    var last_id = null;
    var last_band = null;

    var _doit = function(f) {
        var subpath = f.substring(self.native.length).replace(/^\//, '');
        var parts = subpath.split("/");

        if (parts.length === 2) {
            if (parts[1].match(/^[.]/)) {
                return;
            }

            var this_id = _decode(parts[0]);
            if (id && (this_id !== id)) {
                return;
            }

            var this_band = _decode(parts[1]);
            if (band && (this_band !== band)) {
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

            callback(this_id, this_band, undefined);
        }
    };

    watch.createMonitor(self.native, function (monitor) {
        monitor.on("created", function (f, stat) {
            _doit(f);
        })
        monitor.on("changed", function (f, curr, prev) {
            _doit(f);
        })
        monitor.on("removed", function (f, stat) {
            _doit(f);
        })
    })
};

/**
 */
FSTransport.prototype.remove = function(id, band) {
    var self = this;

    if (!id) {
        throw new Error("id is required");
    }

    var channel = self._channel(id, band);

    fs.readdir(channel, function(error, names) {
        if (error) {
            return;
        }

        var _pop = function() {
            if (names.length === 0) {
                fs.rmdir(channel, function(error) {
                });
            }

            var name = names.pop();
            var path = fs.join(channel, name);

            fs.unlink(channel, function(error) {
                _pop();
            });
        };

        _pop();
    });
};

/* -- internals -- */
FSTransport.prototype._channel = function(id, band, paramd) {
    var self = this;

    paramd = _.defaults(paramd, {
        mkdirs: false,
    });

    var channel = self.native;
    if (id) {
        channel = path.join(channel, _encode(id));

        if (paramd.mkdirs) {
            mkdirp.sync(channel, function(error) {
            });
        }

        if (band) {
            channel = path.join(channel, _encode(band));
        }
    }

    return channel;
};

var _encode = function(s) {
    return s.replace(/[\/$%#.\]\[]/g, function(c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
};

var _decode = function(s) {
    return decodeURIComponent(s);
}

var _unpack = function(d) {
    return _.d.transform(d, {
        pre: _.ld_compact,
        key: _decode,
    });
};

var _pack = function(d) {
    return _.d.transform(d, {
        pre: _.ld_compact,
        key: _encode,
    });
};

/**
 *  API
 */
exports.FSTransport = FSTransport;


var t = new FSTransport();
