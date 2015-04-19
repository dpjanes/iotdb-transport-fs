/*
 *  list.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-03-24
 *
 *  Demonstrate receiving
 *  Make sure to see README first
 */

var FSTransport = require('../FSTransport').FSTransport;

var p = new FSTransport({
});
p.list(function(ld) {
    if (ld.end) {
        return;
    }
    console.log("+", ld.id);
});
