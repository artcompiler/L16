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
    var bytes = new stdlib.Uint8Array(heap);

    var trace = imports.trace;

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
    var $s = 115;
    var $S = 83;

    // Start an object. Allocate space for a new object. 'isBig' means larger
    // than 255 properties.
    function startObject(isBig) {
      isBig = isBig | 0;
      if ((isBig | 0) == 0) {
        bytes[pos] = $o;
        bytes[pos + 1 | 0] = $_;
        pos = pos + 2 | 0;
      } else {
        bytes[pos] = $O;
        bytes[pos + 1 | 0] = $_;
        bytes[pos + 2 | 0] = $_;
        bytes[pos + 3 | 0] = $_;
        bytes[pos + 4 | 0] = $_;
        pos = pos + 5 | 0;
      }
    }

    // Finish an object. Offset is position before calling startObject().
    function finishObject(offset, count, isBig) {
      offset = offset | 0;
      count = count | 0;
      isBig = isBig | 0;
      if ((isBig | 0) == 0) {
        bytes[offset + 1 | 0] = count;
      } else {
        bytes[offset + 1 | 0] = count >> 24 & 0xFF;
        bytes[offset + 2 | 0] = count >> 16 & 0xFF;
        bytes[offset + 3 | 0] = count >> 8 & 0xFF;
        bytes[offset + 4 | 0] = count & 0xFF;
      }
    }

    // Start an array. Allocate space for a new array. 'isBig' means larger
    // than 255 properties.
    function startArray(isBig) {
      isBig = isBig | 0;
      if ((isBig | 0) == 0) {
        bytes[pos] = $a;
        bytes[pos + 1 | 0] = $_;
        pos = pos + 2 | 0;
      } else {
        bytes[pos] = $A;
        bytes[pos + 1 | 0] = $_;
        bytes[pos + 2 | 0] = $_;
        bytes[pos + 3 | 0] = $_;
        bytes[pos + 4 | 0] = $_;
        pos = pos + 5 | 0;
      }
    }

    // Finish an array. Offset is position before calling startArray().
    function finishArray(offset, count, isBig) {
      offset = offset | 0;
      count = count | 0;
      isBig = isBig | 0;
      if ((isBig | 0) == 0) {
        bytes[offset + 1 | 0] = count;
      } else {
        bytes[offset + 1 | 0] = count >> 24 & 0xFF;
        bytes[offset + 2 | 0] = count >> 16 & 0xFF;
        bytes[offset + 3 | 0] = count >> 8 & 0xFF;
        bytes[offset + 4 | 0] = count & 0xFF;
      }
    }

    // Start a String. Allocate space for a new string. 'isBig' more than 255
    // character. Call writeStringChar() to add characters, and finishString()
    // to patch the character count.
    function startString(isBig) {
      isBig = isBig | 0;
      if ((isBig | 0) == 0) {
        bytes[pos] = $s;
        bytes[pos + 1 | 0] = $_;
        pos = pos + 2 | 0;
      } else {
        bytes[pos] = $S;
        bytes[pos + 1 | 0] = $_;
        bytes[pos + 2 | 0] = $_;
        bytes[pos + 3 | 0] = $_;
        bytes[pos + 4 | 0] = $_;
        pos = pos + 5 | 0;
      }
    }

    // Write a UTF8 character into a string.
    function writeStringChar(val) {
      val = val | 0;
      // FIXME decode multibyte characters.
      bytes[pos] = val;
      pos = pos + 1 | 0;
    }

    // Finish a UTF8 string. Patch its byte count.
    function finishString(offset, count, isBig) {
      offset = offset | 0;
      count = count | 0;
      isBig = isBig | 0;
      if ((isBig | 0) == 0) {
        bytes[offset + 1 | 0] = count;
      } else {
        bytes[offset + 1 | 0] = count >> 24 & 0xFF;
        bytes[offset + 2 | 0] = count >> 16 & 0xFF;
        bytes[offset + 3 | 0] = count >> 8 & 0xFF;
        bytes[offset + 4 | 0] = count & 0xFF;
      }
    }

    // Write a UBJSON byte (int8) value.
    function writeByte(val) {
      val = val | 0;
      bytes[pos] = $B;
      bytes[pos + 1 | 0] = val;
      pos = pos + 2 | 0;
    }

    // Write a UBJSON int16 value.
    function writeI16(val) {
      val = val | 0;
      bytes[pos] = $i;
      bytes[pos + 1 | 0] = val >> 8 & 0xFF;
      bytes[pos + 2 | 0] = val & 0xFF;
      pos = pos + 3 | 0;
    }

    // Write a UBJSON int32 value.
    function writeI32(val) {
      val = val | 0;
      bytes[pos] = $I;
      bytes[pos + 1 | 0] = val >> 24 & 0xFF;
      bytes[pos + 2 | 0] = val >> 16 & 0xFF;
      bytes[pos + 3 | 0] = val >> 8 & 0xFF;
      bytes[pos + 4 | 0] = val & 0xFF;
      pos = pos + 5 | 0;
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
    builder.startArray(false);
    builder.writeI32(0xFFFF);
    builder.writeByte(1);
    builder.finishArray(pos.pop(), 2, false);
    
    dumpView();

    function dumpView() {
      var i = 0;
      for (; i < 25; i = i + 1) {
        trace(view[i]);
      }
    }
  }

  if (DEBUG) {
    test();
  }

  return Builder;

})();
