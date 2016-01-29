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
p.list(function(error, ld) {
    if (error) {
        console.log("#", "error", error);
        return;
    }
    if (!ld) {
        console.log("+", "<end>");
        break;
    }

    console.log("+", ld.id);
});
