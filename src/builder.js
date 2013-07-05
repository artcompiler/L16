/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/*
 * Copyright 2013 Art Compiler LLC
 * Copyright 2013 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

/*
  This module implements a builder of UBJSON objects.

     startObject(flags)
     finishObject(size)
     startArray(flags)
     finishArray(size)
     startString(flags)
     finishString(size)
     writeByte(val)
     writeI16(val)
     writeI32(val)
     writeI64(val)
     writeF32(val)
     writeF64(val)

     imported functions

     imports = {
       resizeHeap,
     }

 */

var DEBUG = true;

var assert = !DEBUG
  ? function () { }
  : function (val, str) {
      if ( str === void 0 ) {
        str = "failed!";
      }
      if ( !val ) {
        throw("assert: " + str);
      }
    };

var global = this;

var trace = function trace(str) {
  if (global.console && global.console.log) {
    console.log(str);
  } else if (global.print) {
    print(str);
  } else {
    throw "No trace function defined!";
  }
}


var Builder = (function () {

  var Builder = function Builder(stdlib, imports, heap) {
    "use asm";

    var pos = 0;
    var bytesU8 = new stdlib.Uint8Array(heap);
    var bytesD32 = new stdlib.Float32Array(heap);
    var bytesD64 = new stdlib.Float64Array(heap);

    var trace = imports.trace;
    var imul = stdlib.Math.imul;

    // Markers for UBJSON types
    var $_ = 95;   // place holder byte
    var $o = 111;
    var $O = 79;
    var $a = 97;
    var $A = 65;
    var $B = 66;
    var $i = 105;
    var $I = 73;
    var $L = 76;
    var $d = 100;
    var $D = 68;
    var $s = 115;
    var $S = 83;

    // Flag bits
    var BIG = 0x00000001;

    // Start an object. Allocate space for a new object. (flags & BIG) means
    // more than 255 properties.
    function startObject(flags) {
      flags = flags | 0;
      if ((flags & BIG | 0) == 0) {
        bytesU8[pos] = $o;
        bytesU8[pos + 1 | 0] = $_;
        pos = pos + 2 | 0;
      } else {
        bytesU8[pos] = $O;
        bytesU8[pos + 1 | 0] = $_;
        bytesU8[pos + 2 | 0] = $_;
        bytesU8[pos + 3 | 0] = $_;
        bytesU8[pos + 4 | 0] = $_;
        pos = pos + 5 | 0;
      }
    }

    // Finish an object. Offset is position before calling startObject().
    function finishObject(offset, count, flags) {
      offset = offset | 0;
      count = count | 0;
      flags = flags | 0;
      if ((flags & BIG | 0) == 0) {
        bytesU8[offset + 1 | 0] = count;
      } else {
        bytesU8[offset + 1 | 0] = count >> 24 & 0xFF;
        bytesU8[offset + 2 | 0] = count >> 16 & 0xFF;
        bytesU8[offset + 3 | 0] = count >> 8 & 0xFF;
        bytesU8[offset + 4 | 0] = count & 0xFF;
      }
    }

    // Start an array. Allocate space for a new array. (flags & BIG) means
    // more than 255 elements.
    function startArray(flags) {
      flags = flags | 0;
      if ((flags & BIG | 0) == 0) {
        bytesU8[pos] = $a;
        bytesU8[pos + 1 | 0] = $_;
        pos = pos + 2 | 0;
      } else {
        bytesU8[pos] = $A;
        bytesU8[pos + 1 | 0] = $_;
        bytesU8[pos + 2 | 0] = $_;
        bytesU8[pos + 3 | 0] = $_;
        bytesU8[pos + 4 | 0] = $_;
        pos = pos + 5 | 0;
      }
    }

    // Finish an array. Offset is position before calling startArray().
    function finishArray(offset, count, flags) {
      offset = offset | 0;
      count = count | 0;
      flags = flags | 0;
      if ((flags & BIG | 0) == 0) {
        bytesU8[offset + 1 | 0] = count;
      } else {
        bytesU8[offset + 1 | 0] = count >> 24 & 0xFF;
        bytesU8[offset + 2 | 0] = count >> 16 & 0xFF;
        bytesU8[offset + 3 | 0] = count >> 8 & 0xFF;
        bytesU8[offset + 4 | 0] = count & 0xFF;
      }
    }

    // Start a string value. Allocate space for a new string. (flags & BIG)
    // means contains more 255 bytes. Call writeStringChar() to add characters,
    // and finishString() to patch the byte count. Notice that characters are
    // encoded as UTF8 so they may consist of more than one byte.
    function startString(flags) {
      flags = flags | 0;
      if ((flags & BIG | 0) == 0) {
        bytesU8[pos] = $s;
        bytesU8[pos + 1 | 0] = $_;
        pos = pos + 2 | 0;
      } else {
        bytesU8[pos] = $S;
        bytesU8[pos + 1 | 0] = $_;
        bytesU8[pos + 2 | 0] = $_;
        bytesU8[pos + 3 | 0] = $_;
        bytesU8[pos + 4 | 0] = $_;
        pos = pos + 5 | 0;
      }
    }

    // Finish a string value. Patch its byte count.
    function finishString(offset, count, flags) {
      offset = offset | 0;
      count = count | 0;
      flags = flags | 0;
      if ((flags & BIG | 0) == 0) {
        bytesU8[offset + 1 | 0] = count;
      } else {
        bytesU8[offset + 1 | 0] = count >> 24 & 0xFF;
        bytesU8[offset + 2 | 0] = count >> 16 & 0xFF;
        bytesU8[offset + 3 | 0] = count >> 8 & 0xFF;
        bytesU8[offset + 4 | 0] = count & 0xFF;
      }
    }

    // Write a UTF8 character into a string value.
    function writeStringChar(val) {
      val = val | 0;
      // FIXME decode multibyte characters.
      bytesU8[pos] = val;
      pos = pos + 1 | 0;
    }

    // Write a byte (int8) value.
    function writeByte(val) {
      val = val | 0;
      bytesU8[pos] = $B;
      bytesU8[pos + 1 | 0] = val;
      pos = pos + 2 | 0;
    }

    // Write an int16 value.
    function writeI16(val) {
      val = val | 0;
      bytesU8[pos] = $i;
      bytesU8[pos + 1 | 0] = val >> 8 & 0xFF;
      bytesU8[pos + 2 | 0] = val & 0xFF;
      pos = pos + 3 | 0;
    }

    // Write an int32 value.
    function writeI32(val) {
      val = val | 0;
      bytesU8[pos] = $I;
      bytesU8[pos + 1 | 0] = val >> 24 & 0xFF;
      bytesU8[pos + 2 | 0] = val >> 16 & 0xFF;
      bytesU8[pos + 3 | 0] = val >> 8 & 0xFF;
      bytesU8[pos + 4 | 0] = val & 0xFF;
      pos = pos + 5 | 0;
    }

    // WARNING writeD32() and writeD64() write bytes out with the reverse
    // endian-ness of the host computer. The order is reversed because UBJSON
    // demands big endian-ness and most computers use litte endian as their
    // native encoding. Either way the dependency of this implementation on the
    // native endian-ness of the host computer creates an incompatibility with
    // the UBJSON spec. This bug will only manifest itself when reading and
    // writing UBJSON values from a computer or UBJSON implementation with a
    // different endian-ness. However, these are not use cases that are in scope
    // for the current implementation.

    // Write an float32 value.
    function writeD32(val) {
      val = +val;
      var scratchPos = 0;
      scratchPos = imul(pos + 1, 4) | 0;
      bytesD32[scratchPos >> 2] = val;  // Write out float32 to get bytes.
      bytesU8[pos] = $d;
      // Copy bytes in reverse order to produce big endian on Intel hardward.
      bytesU8[pos + 1 | 0] = bytesU8[scratchPos + 3 | 0];
      bytesU8[pos + 2 | 0] = bytesU8[scratchPos + 2 | 0];
      bytesU8[pos + 3 | 0] = bytesU8[scratchPos + 1 | 0];
      bytesU8[pos + 4 | 0] = bytesU8[scratchPos | 0];
      pos = pos + 5 | 0;
      //trace("pos="+pos);
    }

    // Write an float64 value.
    function writeD64(val) {
      val = +val;
      var scratchPos = 0;
      scratchPos = imul(pos + 1, 8) | 0;
      bytesD64[scratchPos >> 3] = val;  // Write out float64 to get bytes.
      bytesU8[pos] = $D;
      // Copy bytes in reverse order to produce big endian on Intel hardward.
      bytesU8[pos + 1 | 0] = bytesU8[scratchPos + 7 | 0];
      bytesU8[pos + 2 | 0] = bytesU8[scratchPos + 6 | 0];
      bytesU8[pos + 3 | 0] = bytesU8[scratchPos + 5 | 0];
      bytesU8[pos + 4 | 0] = bytesU8[scratchPos + 4 | 0];
      bytesU8[pos + 5 | 0] = bytesU8[scratchPos + 3 | 0];
      bytesU8[pos + 6 | 0] = bytesU8[scratchPos + 2 | 0];
      bytesU8[pos + 7 | 0] = bytesU8[scratchPos + 1 | 0];
      bytesU8[pos + 8 | 0] = bytesU8[scratchPos | 0];
      pos = pos + 9 | 0;
      //trace("pos="+pos);
    }

    // Return the current position in the ArrayBuffer.
    function position() {
      return pos | 0;
    }

    // Exports
    return {
      writeByte: writeByte,
      writeI16: writeI16,
      writeI32: writeI32,
      writeD32: writeD32,
      writeD64: writeD64,
      startObject: startObject,
      finishObject: finishObject,
      startArray: startArray,
      finishArray: finishArray,
      startString: startString,
      finishString: finishString,
      writeStringChar: writeStringChar,
      position: position,
    };
  }

  // Self test

  function test() {
    var buffer = new ArrayBuffer(4096);
    var imports = {
      trace: print,
    }
    var builder = Builder(global, imports, buffer);
    var view = new Uint8Array(buffer);
    var pos = [];
    var BIG = 0x01;
    pos.push(builder.position());
    builder.startObject();
    builder.writeByte(10);
    pos.push(builder.position());
    builder.startString();
    builder.writeStringChar("h".charCodeAt(0));
    builder.writeStringChar("e".charCodeAt(0));
    builder.writeStringChar("l".charCodeAt(0));
    builder.writeStringChar("l".charCodeAt(0));
    builder.writeStringChar("o".charCodeAt(0));
    builder.finishString(pos.pop(), 5);
    builder.finishObject(pos.pop(), 1);
    pos.push(builder.position());
    builder.startArray(BIG);
    builder.writeI32(0xFFFF);
    builder.writeByte(1);
    builder.finishArray(pos.pop(), 2, BIG);
    builder.writeD32(1.23);
    builder.writeD64(1.23);
    builder.writeD32(1.23);
    dumpView();

    function dumpView() {
      var i = 0;
      for ( ; i < 100 ; ) {
        var s = "";
        for (var j = 0; j < 10; i++, j++) {
          s += view[i] + " ";
        }
        trace(s);
      }
    }
  }

  if (DEBUG) {
    test();
  }

  return Builder;

})();
