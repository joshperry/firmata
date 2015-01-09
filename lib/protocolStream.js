'use strict';

var through = require('through2'),
    debug = require('debug')('firmata'),
    consts = require('./constants');


module.exports = function protocolStream(board) {
  var buffer;
  var bufIdx = 0;
  var inSysex = false;

  function flushBuffer() {
    debug('flush');
    bufIdx = 0;
    buffer = new Buffer(4096);
  }

  function emitFrame(emitter) {
    debug('emit frame');
    emitter.emit('frame', buffer.slice(0, bufIdx));
    flushBuffer();
  }

  // Init the buffer
  flushBuffer();

  var parser = function syncParser(data, enc, cb) {
      // Chew through incoming data until we see a high-bit set
      for(var i = 0; i < data.length; i++) {
        if(data[i] & 0x80) {
          debug('synced on high bit');
          parser = frameParser;
          return parser.call(this, data.slice(i), enc, cb);
        }
      }

      cb();
    };

  function frameParser(data, enc, cb) {
    while (data.length > 0) {
      debug('loop', data);

      // Midi command start
      if(data[0] & 0x80) {
        if(!inSysex && data[0] === consts.START_SYSEX) {
          // Found the SYSEX frame start
          debug('START_SYSEX');
          
          inSysex = true;
        }

        debug('copied midi command');
        buffer[bufIdx++] = data[0];
        data = data.slice(1);
      }    
  
      if(!inSysex) {
        // Normal 3 byte MIDI frame
        var toCopy = Math.min(3 - bufIdx, data.length);
        debug('copying midi frame bytes', data, toCopy, bufIdx);
        data.copy(buffer, bufIdx, 0, toCopy);
        data = data.slice(toCopy);
        bufIdx += toCopy;

        // If we got all 3 bytes, emit the frame
        if(bufIdx === 3) {
          emitFrame(this);
        }
      } else {
        // Find the end of the SYSEX frame
        for(var i = 0; i < data.length; i++) {
          if(data[i] === consts.END_SYSEX) {
            inSysex = false;
            break;
          }
        }

        data.copy(buffer, bufIdx, 0, i);
        data = data.slice(i + 1);
        bufIdx += i;

        if(!inSysex)
          emitFrame(this);
      }
    }

    // Done processing the read data
    cb();
  }

  return through(function(chunk, enc, cb) {
    parser.call(this, chunk, enc, cb);
  });
};
