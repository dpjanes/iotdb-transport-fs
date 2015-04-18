/*
 *  receive_flat.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-04-03
 *
 *  Demonstrate receiving
 *  Make sure to see README first
 */

var transport = require('../index');
var FSTransport = transport.Transport;

var p = new FSTransport({
    flat_band: "meta",
    prefix: ".flat",
});
p.updated({
    id: "MyThingID", 
    band: "meta", 
}, function(ud) {
    if (ud.value === undefined) {
        p.get(ud, function(gd) {
            console.log("+", gd.id, gd.band, gd.value);
        });
    } else {
        console.log("+", ud.id, ud.band, ud.value);
    }
});
