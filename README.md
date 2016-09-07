# iotdb-transport-fs
[IOTDB](https://github.com/dpjanes/node-iotdb) 
[Transporter](https://github.com/dpjanes/node-iotdb/blob/master/docs/transporters.md)
for the File System

<img src="https://raw.githubusercontent.com/dpjanes/iotdb-homestar/master/docs/HomeStar.png" align="right" />

Stores on the Filesystem. Listens for changes to the Filesystem so this is pretty full featured Might need some tweaks for Windows.

# About

This Transporter writes files to the file system in JSON, and
should be able to detect if someone else writes to them.

* [Read more about Transporters](https://github.com/dpjanes/node-iotdb/blob/master/docs/transporters.md)

# Use

See the samples folder for working examples

## Basic

Don't forget your `subscribe`s! Most Transporter methods 
return RX Observables.

Note that the path to the `prefix` will be created.

    const fs_transport = require("iotdb-transport-fs");
    const fs_transporter = fs_transport.make({
        prefix: "some-path",
    });

    fs_transport.put({
        id: "light",
        band: "ostate",
        value: { on: true }
    }).subscribe()

## Flat Transporter

You can create a "flat" transporter if you don't want to create 
a folder for each thing and aren't interested in multiple bands.
Instead of create a folder, the filename for the Thing will be the JSON data

    const fs_transport = require("iotdb-transport-fs");
    const fs_transporter = fs_transport.make({
        prefix: "some-path",
        flat_band: "meta",
    });
