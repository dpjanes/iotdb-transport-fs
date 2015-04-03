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
    channel: transport.make_flat_channel("meta"),
    unchannel: transport.make_flat_unchannel("meta"),
    prefix: ".flat",
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
