/*
 *  flat_about.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-04-18
 *
 *  Demonstrate receiving
 *  Make sure to see README first
 */

var FSTransport = require('../FSTransport').FSTransport;

var transport = new FSTransport({
    flat_band: "megatron",
    prefix: ".flat",
});
transport.about({
    id: "MyThingID", 
}, function(ad) {
    if (ad.end) {
        break;
    }

    console.log("+", ad);
});
