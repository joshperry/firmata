'use strict';

module.exports = function serialStreamSource(options) {
  var ports = null;

  try {
    if (process.browser) {
      ports = require("browser-serialport").ports;
      ports.open = function() {
        var port = new ports.SerialPort(options.comname, options);
        port.open();
        return port;
      };
    } else {
      ports = require("serialport");
    }
  } catch (err) {
    console.log("It looks like serialport didn't compile properly. This is a common problem and its fix is well documented here https://github.com/voodootikigod/node-serialport#to-install");
    throw "Missing serialport dependency";
  }

  return function createStream() {
    return ports.open(options);
  };
};
