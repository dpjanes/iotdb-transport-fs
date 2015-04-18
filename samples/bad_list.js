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
p.list(function(ld) {
    if (!ld) {
        return;
    }
    console.log(ld.id);
});
