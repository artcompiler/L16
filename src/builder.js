/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/*
 * Copyright 2013 Art Compiler LLC
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

     Foreign function interface

     ffi = {
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

  var Builder = function Builder(stdlib, ffi, heap) {
    "use asm";

    var pos = 0;
    var bytes = new stdlib.Uint8Array(heap);

    var trace = ffi.trace;

    var $_ = 95;   // place holder
    var $o = 111;
    var $O = 79;
    var $B = 66;
    var $i = 105;
    var $I = 73;
    var $L = 76;

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

    function finishObject(offset, count, isBig) {
      offset = offset | 0;
      count = count | 0;
      isBig = isBig | 0;
      if ((isBig | 0) == 0) {
        bytes[offset + 1 | 0] = count;
      } else {
        bytes[(offset + 1) | 0] = count & 0xFF;
        bytes[(offset + 2) | 0] = count >> 8 & 0xFF;
        bytes[(offset + 3) | 0] = count >> 16 & 0xFF;
        bytes[(offset + 4) | 0] = count >> 24 & 0xFF;
      }
    }

    function writeByte(val) {
      val = val | 0; 
      bytes[pos] = $B;
      bytes[pos + 1 | 0] = val;
      pos = pos + 2 | 0;
    }

    function writeI16(val) {
      val = val | 0;
      bytes[pos] = $i;
      bytes[pos + 1 | 0] = val & 0xFF;
      bytes[pos + 2 | 0] = val >> 8 & 0xFF;
      pos = pos + 3 | 0;
    }

    function position() {
      return pos | 0;
    }

    return {
      writeByte: writeByte,
      writeI16: writeI16,
      startObject: startObject,
      finishObject: finishObject,
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
    var pos = builder.position();
    builder.startObject();
    builder.writeByte(10);
    builder.writeI16(100);
    builder.finishObject(pos, 1);
    dumpView();

    function dumpView() {
      var i = 0;
      for (; i < 10; i = i + 1) {
        trace(view[i]);
      }
    }
  }
  test();

  return Builder;

})();

