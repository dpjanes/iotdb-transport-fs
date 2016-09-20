/*
 *  put_remove.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-09-20
 */

const transporter = require("../transporter");
const _ = require("iotdb")._;

const testers = require("iotdb-transport").testers;

const transport = require("./make").transport;
testers.put(transport);
testers.remove(transport);

setTimeout(() => {
    testers.get(transport);
}, 250);
