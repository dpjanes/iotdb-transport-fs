/*
 *  transporter.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-07-25
 *
 *  Copyright [2013-2016] [David P. Janes]
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

const iotdb = require('iotdb');
const _ = iotdb._;
const iotdb_transport = require('iotdb-transport');
const errors = require('iotdb-errors');

const Rx = require('rx');
const events = require('events');

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const watch = require('watch');
const rwlock = require('rwlock'); 

const util = require('util');
const url = require('url');

const logger = iotdb.logger({
    name: 'iotdb-transport-fs',
    module: 'transporter',
});

let safe_rex = /[\/$%#\]\[]/g;
if (/^win/.test(process.platform)) {
    safe_rex = /[:\/$%#\]\[]/g;
}

const _lock = new rwlock();

const _filter_file = path => {
    try {
        fs.readFileSync(path, { encoding: 'utf8' });
        return path;
    } catch (x) {
    }
};

const _filter_folder = path => {
    try {
        if (fs.statSync(path, { encoding: 'utf8' }).isDirectory()) {
            return path;
        }
    } catch (x) {
    }
};

const make = (initd, bddd) => {
    const self = iotdb_transport.make();

    const _initd = _.d.compose.shallow(
        initd, {
            channel: iotdb_transport.channel,
            unchannel: iotdb_transport.unchanneld,
            encode: s => s.replace(safe_rex, (c) => '%' + c.charCodeAt(0).toString(16)),
            decode: s => decodeURIComponent(s),
            unpack: (d, id, band) => _.d.transform(d, { pre: _.ld_compact, key: _initd._decode, }),
            pack: (d, id, band) => _.d.transform(d, { pre: _.ld_compact, key: _initd._encode, }),
        },
        iotdb.keystore().get("/transports/FSTransport/initd"), {
            prefix: ""
        }
    );

    self.rx.list = (observer, d) => {
        _lock.readLock(release => {
            fs.readdir(_initd.prefix, function (error, names) {
                release();

                if (error) {
                    return observer.onError(error);
                }

                names
                    .sort()
                    .map(name => path.join(_initd.prefix, name))
                    .filter(folder => _filter_folder(folder))
                    .map(folder => _initd.unchannel(_initd, folder))
                    .filter(cd => cd.id)
                    .forEach(cd => {
                        d = _.d.clone.shallow(d);
                        d.id = cd.id;

                        observer.onNext(d);
                    });

                observer.onCompleted();
            });
        });
    };

    self.rx.put = (observer, d) => {
        const channel = _initd.channel(_initd, d.id, d.band);
        const outd = _initd.pack(d.value, d.id, d.band);

        _lock.writeLock(release => {
            mkdirp.mkdirp(path.dirname(channel), error => {
                if (error) {
                    return observer.onError(error);
                }

                let old_data = null;
                const new_data = JSON.stringify(outd, null, 2);
                if (_initd.check_changed) {
                    try {
                        old_data = fs.readFileSync(channel);
                    } catch (x) {
                    }
                }

                if (new_data !== old_data) {
                    fs.writeFileSync(channel, new_data);
                }

                release();

                observer.onNext(d);
                observer.onCompleted();
            });
        });
    };
    
    self.rx.get = (observer, d) => {
        const channel = _initd.channel(_initd, d.id, d.band);

        _lock.readLock(release => {
            fs.readFile(channel, { encoding: 'utf8' }, (error, doc) => {
                release();

                if (error) {
                    if (error.code === 'ENOENT') {
                        return observer.onCompleted();
                    } else {
                        return observer.onError(error);
                    }
                }

                d.value = _initd.unpack(JSON.parse(doc), d.id, d.band);

                observer.onNext(d);
                observer.onCompleted();
            });
        });
    };
    
    self.rx.bands = (observer, d) => {
        const channel = _initd.channel(_initd, d.id);

        const _bands_flat = () => {
            _lock.readLock(release => {
                fs.readFile(channel, {
                    encoding: 'utf8'
                }, (error, doc) => {
                    release();

                    if (!error) {
                        d.band = _initd.flat_band;
                        
                        observer.onNext(d);
                    }

                    observer.onComplete();
                });
            });
        };

        const _bands = () => {
            _lock.readLock(release => {
                fs.readdir(channel, function (error, names) {
                    release();

                    if (error) {
                        if (error.code === 'ENOENT') {
                            return observer.onCompleted();
                        } else {
                            return observer.onError(error);
                        }
                    }

                    names
                        .sort()
                        .map(name => path.join(channel, name))
                        .filter(path => _filter_file(path))
                        .map(path => _initd.unchannel(_initd, path))
                        .filter(cd => cd.id && cd.band)
                        .forEach(cd => {
                            observer.onNext(_.d.compose.shallow(d, cd));
                        });

                    observer.onCompleted();
                });
            });
        };

        if (_initd.flat_band) {
            _bands_flat()
        } else {
            _bands();
        }
    };

    self.rx.updated = (observer, d) => {
        let lastd = {};
        let last_time = 0;

        // this could be Rxed
        const _doit = function (f) {
            const cd = _initd.unchannel(_initd, f);
            if (!cd) {
                return;
            }

            if (d.id && (cd.id !== d.id)) {
                return;
            }

            if (d.band && (cd.band !== d.band)) {
                return;
            }

            // debounce, sigh 
            var now = (new Date()).getTime();
            if ((cd.id === lastd.id) && (cd.band === lastd.band) && ((now - last_time) < 50)) {
                return;
            }

            lastd = cd;
            last_time = now;

            d = _.d.compose.shallow(cd, d);

            observer.onNext(d);
        };

        _lock.writeLock(function (release) {
            watch.createMonitor(_initd.prefix, function (monitor) {
                monitor.on("created", function (f, stat) {
                    _doit(f);
                });
                monitor.on("changed", function (f, curr, prev) {
                    _doit(f);
                });
                monitor.on("removed", function (f, stat) {
                    _doit(f);
                });

                setTimeout(function() {
                    release();
                }, 1000);
            });
        });
    };


    // ignore errors - they will hppen again later
    _lock.writeLock(release => {
        mkdirp.mkdirp(_initd.prefix, error => {
            release();
        });
    });

    return self;
};

/**
 *  API
 */
exports.make = make;
