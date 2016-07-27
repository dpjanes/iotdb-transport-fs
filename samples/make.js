/*
 *  make.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-07-27
 */

const path = require("path");

const transporter = require("../transporter");
const transport = transporter.make({
    prefix: path.join(__dirname, "things"),
});

exports.transport = transport;
