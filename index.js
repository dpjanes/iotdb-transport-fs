/*
 *  index.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-03-27
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

var FSTransport = require('./FSTransport');

exports.Transport = FSTransport.FSTransport;

exports.make_flat_channel = FSTransport.make_flat_channel;
exports.make_flat_unchannel = FSTransport.make_flat_unchannel;
exports.flat_channel = FSTransport.flat_channel;
exports.flat_unchannel = FSTransport.flat_unchannel;
