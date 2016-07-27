/*
 *  bad_list.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-03-07
 *
 *  Deal with data that does not exist
 *  Expect to see just 'null'
 */

var FSTransport = require('../FSTransport').FSTransport;

var p = new FSTransport({
});
p.list(function(error, ld) {
    if (error) {
        console.log("#", "error", error);
        return;
    }
    if (!ld) {
        console.log("+", "<end>");
        return;
    }

    console.log(ld.id);
});
