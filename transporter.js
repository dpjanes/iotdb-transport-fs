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
const assert = require('assert');

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

const make = (initd) => {
    const self = iotdb_transport.make();
    self.name = "iotdb-transport-fs";

    const _initd = _.d.compose.shallow(
        initd, {
            channel: iotdb_transport.channel,
            unchannel: iotdb_transport.unchannel,
            encode: s => s.replace(safe_rex, (c) => '%' + c.charCodeAt(0).toString(16)),
            decode: s => decodeURIComponent(s),
            unpack: (doc, d) => JSON.parse(doc), 
            pack: d => JSON.stringify(d.value, null, 2),
        },
        iotdb.keystore().get("/transports/iotdb-transport-fs/initd"), {
            prefix: "",
            flat_band: null,
        }
    );

    assert.ok(!_.is.Empty(_initd.prefix), "initd.prefix is required");

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
                        const rd = _.d.clone.shallow(d);
                        rd.id = cd.id;

                        observer.onNext(rd);
                    });

                observer.onCompleted();
            });
        });
    };

    self.rx.put = (observer, d) => {
        const channel = _initd.channel(_initd, d);

        _lock.writeLock(release => {
            const _doit = error => {
                if (error) {
                    return observer.onError(error);
                }

                const rd = _.d.clone.shallow(d);
                rd.value = _.timestamp.add(rd.value);

                let old_value = null;
                try {
                    old_value = JSON.parse(fs.readFileSync(channel));
                } catch (x) {
                }

                if (_.timestamp.check.dictionary(old_value, rd.value) !== false) {
                    fs.writeFileSync(channel, _initd.pack(rd));
                    observer.onNext(d);
                    observer.onCompleted();
                } else {
                    observer.onError(new errors.Timestamp());
                }
            };

            mkdirp.mkdirp(path.dirname(channel), error => {
                _doit(error);
                release();
            });
        });
    };
    
    self.rx.get = (observer, d) => {
        const channel = _initd.channel(_initd, d);

        _lock.readLock(release => {
            fs.readFile(channel, { encoding: 'utf8' }, (error, doc) => {
                release();

                if (error) {
                    if (error.code === 'ENOENT') {
                        return observer.onError(new errors.NotFound());
                    } else {
                        return observer.onError(error);
                    }
                }

                const rd = _.d.clone.shallow(d);
                rd.value = _initd.unpack(doc, rd);

                observer.onNext(rd);
                observer.onCompleted();
            });
        });
    };
    
    self.rx.bands = (observer, d) => {
        const channel = _initd.channel(_initd, {
            id: d.id
        });

        const _bands_flat = () => {
            _lock.readLock(release => {
                fs.readFile(channel, {
                    encoding: 'utf8'
                }, (error, doc) => {
                    release();

                    if (error) {
                        if (error.code === 'ENOENT') {
                            return observer.onError(new errors.NotFound());
                        } else {
                            return observer.onError(error);
                        }
                    }

                    const rd = _.d.clone.shallow(d);
                    rd.band = _initd.flat_band;
                    
                    observer.onNext(rd);
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
                            return observer.onError(new errors.NotFound());
                        } else {
                            return observer.onError(error);
                        }
                    }

                    names
                        .filter(name => !name.match(/^[.]/))
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
        const _on_fs_update = function (f) {
            const cd = _initd.unchannel(_initd, f);
            if (_.is.Empty(cd) || _.is.Empty(cd.id) || _.is.Empty(cd.band)) {
                return;
            }

            if (d.id && (cd.id !== d.id)) {
                return;
            }

            if (d.band && (cd.band !== d.band)) {
                return;
            }
            
            if (cd.band && cd.band.match(/^[.]/)) {
                return;
            }

            // debounce, sigh 
            var now = (new Date()).getTime();
            if ((cd.id === lastd.id) && (cd.band === lastd.band) && ((now - last_time) < 50)) {
                return;
            }

            lastd = cd;
            last_time = now;

            const rd = _.d.compose.shallow(cd, d);

            observer.onNext(rd);
        };

        watch.createMonitor(_initd.prefix, function (monitor) {
            monitor.on("created", function (f, stat) {
                _on_fs_update(f);
            });
            monitor.on("changed", function (f, curr, prev) {
                _on_fs_update(f);
            });
            monitor.on("removed", function (f, stat) {
                _on_fs_update(f);
            });
        });
    };

    self.rx.remove = (observer, d) => {
        const channel = _initd.channel(_initd, {
            id: d.id
        });

        const _bands = () => {
            _lock.readLock(release => {
                fs.readdir(channel, function (error, names) {
                    release();

                    if (error) {
                        if (error.code === 'ENOENT') {
                            return observer.onError(new errors.NotFound());
                        } else {
                            return observer.onError(error);
                        }
                    }

                    names
                        .map(name => path.join(channel, name))
                        .filter(path => _filter_file(path))
                        .forEach(path => {
                            fs.unlinkSync(path);

                            logger.warn({
                                path: path,
                            }, "removed file");
                        });

                    fs.rmdirSync(channel);
                    logger.warn({
                        path: channel,
                    }, "removed folder (and hence, the thing)");

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


    mkdirp.sync(_initd.prefix);

    return self;
};

/**
 *  API
 */
exports.make = make;
