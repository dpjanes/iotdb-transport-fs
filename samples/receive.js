/*
 *  receive.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-03-07
 *
 *  Demonstrate receiving
 *  Make sure to see README first
 */

var FSTransport = require('../FSTransport').FSTransport;

var p = new FSTransport({
});
p.updated("MyThingID", "meta", function(id, band, value) {
    if (value === undefined) {
        p.get(id, band, function(_id, _band, value) {
            console.log("+", id, band, value);
        });
    } else {
        console.log("+", id, band, value);
    }
});
