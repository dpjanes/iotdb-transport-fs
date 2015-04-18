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
p.get({
    id: "MyThingID", 
    band: "meta", 
}, function(gd) {
    console.log("+", "get", gd.id, gd.band, gd.value);
});
p.updated(function(ud) {
    if (ud.value === undefined) {
        p.get(ud, function(gd) {
            console.log("+", gd.id, gd.band, gd.value);
        });
    } else {
        console.log("+", ud.id, ud.band, ud.value);
    }
});
