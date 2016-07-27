/*
 *  send_flat.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-04-03
 *
 *  Demonstrate sending something
 *  Make sure to see README first
 */

var transport = require('../index');
var FSTransport = transport.Transport;

var p = new FSTransport({
    flat_band: "meta",
    prefix: ".flat",
});

var _update = function() {
    var now = (new Date()).toISOString();
    console.log("+ sent update", now);
    p.update({
        id: "MyThingID", 
        band: "meta", 
        value: {
            first: "David",
            last: "Janes",
            now: now,
        },
    });
};

setInterval(_update, 10 * 1000);
_update();
