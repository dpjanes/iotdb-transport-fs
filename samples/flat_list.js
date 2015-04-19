/*
 *  list_flat.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-04-18
 *
 *  Make sure to see README first
 */

var FSTransport = require('../FSTransport').FSTransport;

var p = new FSTransport({
    flat_band: "meta",
    prefix: ".flat",
});
p.list(function(ld) {
    if (ld.end) {
        return;
    }

    console.log("+", ld.id);
});
