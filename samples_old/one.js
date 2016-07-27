/*
 *  all.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-01-07
 *
 *  Get all data from the the FS Transport
 */

var iotdb = require('iotdb');
var _ = iotdb._;

var path = require('path');

var FSTransport = require('../FSTransport').FSTransport;

var p = new FSTransport({
    prefix: path.join(__dirname, "things"),
});
p.all({
    id: "thing-06",
    bands: [ "model", "meta" ],
}, function(error, d) {
    if (error) {
        console.log("#", _.error.message(error));
        return;
    } else if (!d) {
        console.log("+", "finished");
    } else {
        console.log("+", "item", "\n ", d);
    }
});
