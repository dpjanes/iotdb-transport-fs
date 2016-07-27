/*
 *  make.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-07-24
 */

const transporter = require("../transporter");
const transport = transporter.make({
    prefix: "samples/things",
});

exports.transport = transport;
