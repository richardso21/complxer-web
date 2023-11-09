import { LC3vm } from "./lc3";
import { signExt } from "./utils";

const IMM5_TOGGLE = 1 << 5;
const JSR_TOGGLE = 1 << 11;
const USER_MODE = 1 << 15;
const IMM5 = 0b0000_0000_0001_1111;
const DR = 0b0000_1110_0000_0000;
const BaseR = 0b0000_0001_1100_0000;
const SR2 = 0b0000_0000_0000_0111;
const PC_OFFSET9 = 0b0000_0001_1111_1111;
const PC_OFFSET11 = 0b0000_0111_1111_1111;
const PC_OFFSET6 = 0b0000_0000_0011_1111;
const TRAP_VECTOR8 = 0b0000_0000_1111_1111;

type opFunction = (lc3: LC3vm) => void;

export const opFuncMap: Map<number, opFunction> = new Map<number, opFunction>([
  [0b0000, br],
  [0b0001, add],
  [0b0010, ld],
  [0b0011, st],
  [0b0100, jsr],
  [0b0101, and],
  [0b0110, ldr],
  [0b0111, str],
  [0b1000, rti],
  [0b1001, not],
  [0b1010, ldi],
  [0b1011, sti],
  [0b1100, jmp],
  // opcode 0b1101 is reserved
  [0b1110, lea],
  [0b1111, trap],
]);

// helpers for common patterns

// used whenever we need to put something to the reg file
function _loadToReg(lc3: LC3vm, val: number, updateCC: boolean = true) {
  lc3.regFile[(lc3.ir & DR) >> 9] = val; // destination register is specified in DR bits
  if (updateCC) lc3.cc = val;
}

// used whenever we need to put something to the memory module
function _storeToMem(lc3: LC3vm, address: number): void {
  // SR (in place of DR for ST + variants) specifies source register
  lc3.setMem(address, lc3.regFile[(lc3.ir & DR) >> 9]);
}

// branching

function br(lc3: LC3vm): void {
  if (lc3.cc & (lc3.ir & DR)) {
    lc3.pc += signExt(lc3.ir & PC_OFFSET9, 9);
  }
}

function jmp(lc3: LC3vm): void {
  const reg = (lc3.ir & BaseR) >> 6;
  if (reg === 7) lc3.stack.pop(); // RET instruction, pop from stack
  lc3.pc = lc3.regFile[reg];
  throw new Error("Function not implemented.");
}

function jsr(lc3: LC3vm): void {
  lc3.stack.push(lc3.pc - 1);
  lc3.regFile[7] = lc3.pc;
  if (lc3.ir & JSR_TOGGLE) {
    lc3.pc += signExt(lc3.ir & PC_OFFSET11, 11);
  } else {
    lc3.pc += lc3.regFile[(lc3.ir & BaseR) >> 6];
  }
}

// ALU operations

function add(lc3: LC3vm): void {
  const add1 = lc3.regFile[(lc3.ir & BaseR) >> 6];
  let add2;
  if (IMM5_TOGGLE & lc3.ir) {
    add2 = signExt(lc3.ir & IMM5, 5);
  } else {
    add2 = lc3.regFile[lc3.ir & SR2];
  }
  const res = add1 + add2;
  _loadToReg(lc3, res);
}

function and(lc3: LC3vm): void {
  const add1 = lc3.regFile[(lc3.ir & BaseR) >> 6];
  let add2;
  if (IMM5_TOGGLE & lc3.ir) {
    add2 = signExt(lc3.ir & IMM5, 5);
  } else {
    add2 = lc3.regFile[lc3.ir & SR2];
  }
  const res = add1 & add2;
  _loadToReg(lc3, res);
}

function not(lc3: LC3vm): void {
  const res = ~lc3.regFile[(lc3.ir & BaseR) >> 6];
  _loadToReg(lc3, res);
}

// Load & variants

function ld(lc3: LC3vm): void {
  const effectiveAddress = lc3.pc + signExt(lc3.ir & PC_OFFSET9, 9);
  _loadToReg(lc3, lc3.getMem(effectiveAddress));
}

function ldr(lc3: LC3vm): void {
  const baseRegAddress =
    ((lc3.ir & BaseR) >> 6) + signExt(lc3.ir & PC_OFFSET6, 6);
  _loadToReg(lc3, lc3.getMem(baseRegAddress));
}

function ldi(lc3: LC3vm): void {
  const indirectAddress = lc3.getMem(lc3.pc + signExt(lc3.ir & PC_OFFSET9, 9));
  _loadToReg(lc3, lc3.getMem(indirectAddress));
}

function lea(lc3: LC3vm): void {
  const effectiveAddress = lc3.pc + signExt(lc3.ir & PC_OFFSET9, 9);
  _loadToReg(lc3, effectiveAddress, false); // LEA should not update CC
}

// Store & variants

function st(lc3: LC3vm): void {
  const effectiveAddress = lc3.pc + signExt(lc3.ir & PC_OFFSET9, 9);
  _storeToMem(lc3, effectiveAddress);
}

function str(lc3: LC3vm): void {
  const baseRegAddress =
    ((lc3.ir & BaseR) >> 6) + signExt(lc3.ir & PC_OFFSET6, 6);
  _storeToMem(lc3, baseRegAddress);
}

function sti(lc3: LC3vm): void {
  const indirectAddress = lc3.getMem(lc3.pc + signExt(lc3.ir & PC_OFFSET9, 9));
  _storeToMem(lc3, indirectAddress);
}

// TRAPs and supervisor stuff

function trap(lc3: LC3vm): void {
  if ((lc3.ir & TRAP_VECTOR8) === 0x0025) {
    // stop everything if TRAP HALT
    lc3.Stop(); // we don't need MCR if halt is
    return;
  }
  if (lc3.psr & USER_MODE) {
    // check if user mode, if so switch context to supervisor
    lc3.savedUSP = lc3.regFile[6];
    lc3.regFile[6] = lc3.savedSSP;
  }
  lc3.setMem(lc3.regFile[6]++, lc3.pc); // push PC onto stack
  lc3.setMem(lc3.regFile[6]++, lc3.psr); // push PSR onto stack
  lc3.psr &= ~USER_MODE; // set bit 15 to 0 to ensure supervisor mode
  lc3.pc = lc3.getMem(lc3.ir & TRAP_VECTOR8);
}

function rti(lc3: LC3vm): void {
  lc3.psr = lc3.getMem(lc3.regFile[6]--); // restore PSR
  lc3.pc = lc3.getMem(lc3.regFile[6]--); // restore PC
  if (lc3.psr & USER_MODE) {
    // if previous PSR indicates user mode, switch context back to user
    lc3.savedSSP = lc3.regFile[6];
    lc3.regFile[6] = lc3.savedUSP;
  }
}
