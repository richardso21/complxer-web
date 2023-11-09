import { opFuncMap } from "./ops";
import { lc3os } from "./os";
import { AccessViolationError, toBinStr, toHexStr } from "./utils";

export const KBSRADDR = 0xfe00; // keyboard status
export const KBDRADDR = 0xfe02; // keyboard data
export const DSRADDR = 0xfe04; // display status
export const DDRADDR = 0xfe06; // display data

/**
 * A class representing an LC-3 virtual machine.
 */
export class LC3vm {
  // JS don't have an integer or uint type, their "number" type encapsulates
  // floating points but are 32-bit ints in the context of bitwise operators.
  // The best we can do is enforce the memory and registers to be an array of
  // uint16 types, so whatever bits that overflow during any ALU operation will
  // be cut off when put back into them.
  private mem: Uint16Array;
  regFile: Uint16Array;
  // pc, ir, psr will be stored in a 1-length uint16array with getters/setters
  // to ensure they are always 16-bit unsigned integers
  pcReg: Uint16Array;
  irReg: Uint16Array;
  psrReg: Uint16Array;
  savedUSPReg: Uint16Array;
  savedSSPReg: Uint16Array;
  nzp: boolean[];
  halt: boolean; // "software" halt instead of MCR
  stack: number[]; // keep a list of previous subroutine callers
  ignorePrivilege: boolean;
  // following two used for RunTick that utilizes setInterval for macro state loop
  intervalId: number | null;
  tickRate: number;
  executionLimit: number;
  // buffers will be utilized with the GUI to receive/display characters
  keyboardBuffer: string[];
  outputBuffer: string[];

  constructor({
    ignorePrivilege = false,
    randomize = true,
    tickRate = 10,
    executionLimit = 100000,
    startPC = 0x3000,
  }: {
    ignorePrivilege: boolean;
    randomize: boolean;
    tickRate: number;
    executionLimit: number;
    startPC: number;
  }) {
    const mem = Array.from(
      { length: 1 << 16 },
      () =>
        randomize
          ? Math.floor(Math.random() * 0x10000) // randomly-filled initialization
          : 0 // start with all zeros
    );
    // load os onto beginning of 2^16-length array
    mem.splice(0, lc3os.length, ...lc3os);
    this.mem = new Uint16Array(mem); // enforce uint16 types on each element
    this.regFile = new Uint16Array(8);
    this.pcReg = new Uint16Array([startPC]);
    this.irReg = new Uint16Array([0x0000]);
    this.psrReg = new Uint16Array([0x0000]);
    this.savedUSPReg = new Uint16Array([0x0000]);
    this.savedSSPReg = new Uint16Array([0x2fff]);
    this.nzp = [false, true, false];
    this.halt = false;
    this.stack = [];
    this.ignorePrivilege = ignorePrivilege;
    this.tickRate = tickRate;
    this.executionLimit = executionLimit;
    this.intervalId = null;
    this.keyboardBuffer = [];
    this.outputBuffer = [];
  }

  // high-level VM controls

  public Stop(): void {
    this.halt = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public RunTick(): void {
    // leverage setInterval with tick rate to cycle through 'macro-states'
    this.intervalId = setInterval(() => this.Step(), this.tickRate);
  }

  public Run(): void {
    // keep running until halt or execution limit reached
    let limitLeft = this.executionLimit;
    while (!this.halt && limitLeft-- > 0) {
      this.Step();
    }
    if (!this.halt && limitLeft == 0) {
      throw Error(
        `Infinite loop in program. Last position of PC: ${toHexStr(
          this.pc
        )}. Halting...`
      );
    }
  }

  public Step(): void {
    if (this.pc >= 0xfe00 || (!this.ignorePrivilege && this.pc < 0x3000)) {
      // don't touch memory-mapped IO, and at supervisor space w.r.t. setting
      throw Error(`PC: ${toHexStr(this.pc)}, Out of Bounds`);
    }
    this.fetch();
    this.execute();
  }

  private fetch(): void {
    this.ir = this.mem[this.pc];
    this.pc++;
  }

  private execute(): void {
    const opcode = this.ir >> 12;
    const opFunc = opFuncMap.get(opcode);
    if (opFunc === undefined) {
      throw Error(
        `IR: ${toHexStr(this.ir)}, opcode: ${toBinStr(
          opcode
        )}, Unknown Instruction`
      );
    }
    opFunc(this);
  }

  // public api for storing or getting elements in memory, supporting I/O
  public getMem(address: number): number {
    if (
      address > 0xffff ||
      address < 0 ||
      (!this.ignorePrivilege && address < 0x3000)
    )
      throw new AccessViolationError(this, address);
    if (address === KBSRADDR) {
      // status bit on for KBSR only if buffer is filled
      return this.keyboardBuffer.length > 0 ? 0x8000 : 0x0000;
    } else if (address === KBDRADDR) {
      // return first keypress in buffer, return 0 if nothing was inputted yet
      return this.keyboardBuffer.shift()?.charCodeAt(0) ?? 0x0000;
    } else if (address === DSRADDR) {
      return 0x8000; // assume display/console will always be ready to print
    }
    if (!this.ignorePrivilege && address >= 0xfe00) {
      // do not allow memory access to anywhere else other than those status registers and KBDR
      throw new AccessViolationError(this, address);
    }
    return this.mem[address];
  }

  public setMem(address: number, val: number): void {
    if (
      address > 0xffff ||
      address < 0 ||
      (!this.ignorePrivilege && address < 0x3000)
    )
      throw new AccessViolationError(this, address);
    if (address === DDRADDR) {
      // put into output buffer for 'display'
      this.outputBuffer.push(String.fromCharCode(val));
      return;
    }
    if (!this.ignorePrivilege && address >= 0xfe00) {
      // do not allow memory access to anywhere else other than those status registers and KBDR
      throw new AccessViolationError(this, address);
    }
    this.mem[address] = val;
  }

  // Getters and Setters

  public get cc(): number {
    let res = 0;
    if (this.nzp[0]) res |= 1 << 2;
    if (this.nzp[1]) res |= 1 << 1;
    if (this.nzp[2]) res |= 1;
    return res;
  }

  public set cc(val: number) {
    if (val === 0) {
      this.nzp = [false, true, false];
    } else if (val > 0) {
      this.nzp = [false, false, true];
    } else {
      this.nzp = [true, false, false];
    }
  }

  public get pc(): number {
    return this.pcReg[0];
  }

  public set pc(val: number) {
    this.pcReg[0] = val;
  }

  public get ir(): number {
    return this.irReg[0];
  }

  public set ir(val: number) {
    this.irReg[0] = val;
  }

  public get psr(): number {
    return this.irReg[0];
  }

  public set psr(val: number) {
    this.irReg[0] = val;
  }

  public get savedUSP(): number {
    return this.savedUSPReg[0];
  }

  public set savedUSP(val: number) {
    this.savedUSPReg[0] = val;
  }

  public get savedSSP(): number {
    return this.savedSSPReg[0];
  }

  public set savedSSP(val: number) {
    this.savedSSPReg[0] = val;
  }

  // Loading object files

  public loadFromUint16Array(arr: Uint16Array): void {
    let i = 0;
    while (i < arr.length) {
      // expect header containing starting memory address to place values into mem
      const memStart = arr[i++];
      // next content of header should be length of instructions to include
      const length = arr[i++];
      for (let j = 0; j < length; j++) {
        const location = memStart + j;
        if (
          !this.ignorePrivilege &&
          (location < 0x3000 || location >= 0xfe00)
        ) {
          throw Error(
            `Writing memory into supervisor-reserved data (ADDR: ${toHexStr(
              location
            )}) with ignore privilege turned off!`
          );
        }
        this.setMem(location, arr[i++]); // put instruction/data in memory
      }
    }
  }

  public loadFromFile(lc3);
}

// const lc3 = new LC3vm();
// console.log(lc3.getMem(0x0025));

// lc3.Run();

// setTimeout(() => lc3.Stop(), 3000);
