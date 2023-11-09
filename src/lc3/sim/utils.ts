import { LC3vm } from "./lc3";

export function signExt(val: number, numBits: number): number {
  const shift = 32 - numBits; // bitwise operators work in 32 bits in JS
  return (val << shift) >> shift; // left shift to MSB of 32 bit number, right shift back to original position
}

export function toHexStr(val: number, padding: number = 4): string {
  // https://stackoverflow.com/questions/1267283/how-can-i-pad-a-value-with-leading-zeros
  return (
    "0x" +
    ("0".repeat(padding) + (+val).toString(16).toUpperCase()).slice(-padding)
  );
}

export function toBinStr(val: number, padding: number = 4): string {
  return "0b" + ("0".repeat(padding) + (+val).toString(2)).slice(-padding);
}

export class AccessViolationError extends Error {
  constructor(lc3: LC3vm, address: number) {
    super(
      `Access Violation. ADDR: ${toHexStr(address)}, PC: ${toHexStr(
        lc3.pc
      )}, IR: ${toHexStr(lc3.ir)}`
    );
    this.name = "AccessViolationError";
  }
}
