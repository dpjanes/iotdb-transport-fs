/*
 *  about.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-04-18
 *
 *  Make sure to see README first
 */

var FSTransport = require('../FSTransport').FSTransport;

var transport = new FSTransport({
});
transport.bands({
    id: "MyThingID", 
}, function(error, ad) {
    if (error) {
        console.log("#", error);
        return;
    }

    console.log("+", ad);
});
