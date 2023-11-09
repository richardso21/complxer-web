import { LC3vm } from "./lc3";
import { toHexStr } from "./utils";

export function loadFromUint16Array(lc3: LC3vm, arr: Uint16Array): void {
  let i = 0;
  while (i < arr.length) {
    // expect header containing starting memory address to place values into mem
    const memStart = arr[i++];
    // next content of header should be length of instructions to include
    const length = arr[i++];
    for (let j = 0; j < length; j++) {
      const location = memStart + j;
      if (!lc3.ignorePrivilege && (location < 0x3000 || location >= 0xfe00)) {
        throw Error(
          `Writing memory into supervisor-reserved data (ADDR: ${toHexStr(
            location
          )}) with ignore privilege turned off!`
        );
      }
      lc3.setMem(location, arr[i++]); // put instruction/data in memory
    }
  }
}

// export function loadFromFile(lc3: LC3vm, arr)