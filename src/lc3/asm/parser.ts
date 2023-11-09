interface ParsedLine {
  line: string;
  label: string;
  op: string;
  arg0: string;
  arg1?: string;
  arg2?: string;
  comment?: string;
}

function pprocProgramStr(programStr: string): string {
  programStr = programStr.trim();
  // removes any standalone comments
  programStr = programStr.replace(/^(?:\s*;+.*)/gim, "");
  // stich labels to their instructions if separated
  // (removes any comments in between)
  programStr = programStr.replace(/^([\w\d]+)(?:\s*;+.*)*\s*\n/gim, "$1 ");
  return programStr;
}

function tokenizeASM(programStr: string): ParsedLine[] {
  const programLines = programStr.split('\n');
  for (let lineNum = 0; lineNum < programLines.length; lineNum++) {
    const line = programLines[lineNum];
    // TODO: convert line into ParsedLine objects
  }
  // const programLines = programStr.split("\n");
  // let prevLabel: string = "";
  // let currParsedLine: ParsedLine = {} as ParsedLine;
  // for (let lineNum = 0; lineNum < programLines.length; lineNum++) {
  //   const line = programLines[lineNum];
  //   const [programLine, comment] = line.split(/[\s;]+(.*)/);
  //   currParsedLine.comment = comment;
  //   const tokens = programLine.split(/[\s,]+/); // split line by whitespace and commas
  //   if (tokens.length === 1 && tokens[0]) {
  //     // single token is a label, keep track of it
  //     if (prevLabel !== "") {
  //       // case that we were already tracking another label
  //       throw Error(
  //         `Multiple labels defined for an instruction (line ${lineNum}): ${line}`
  //       );
  //     }
  //     prevLabel = tokens[0];
  //   } else if (tokens.length > 5) {
  //     throw Error(
  //       `Too many arguments/tokens in instruction (line ${lineNum}): ${line}`
  //     );
  //   } else if (tokens.length === 4) {
  //   }
  // }

  return [];
}

export async function parseASM(blob: Blob) {
  let programStr = await webBlobToText(blob);
  programStr = pprocProgramStr(programStr)
  tokenizeASM(programStr);
  // const linesRegEx =
  //   /(?<instruction>[.\w]+)\s+(?<arg0>[#a-z0-9]+)?,?[ \t]*(?<arg1>[#a-z0-9]+)?,?[ \t]*(?<arg2>[#a-z0-9]+)?\n/gi;
  // let i;
  // const symbolTable = createSymTable(lines);
  // for (i of lines) {
  //   console.log(i);
  // }
  // console.log(text);
}

function createSymTable(instructions: ParsedLine[]) {
  const symTable = {};
  let i = 0;
  while (i < instructions.length) {}
}

// function tokenizePseudoOps(line: string): string[] {}

// function tokenizeLine(line: string, lineNum: number): ParsedLine {
//   const res = line.match(
//     /(?<instruction>[a-z]+)\s(?<arg0>R[0-7]),?(?: |\t)*(?<arg1>R[0-7]),?(?: |\t)*(?<arg2>R[0-7]|[#|x|b]?[0-9]+)/gi
//   );
//   if (!res) {
//     throw SyntaxError(`Invalid assembly syntax at line ${lineNum}: ${line}`);
//   }
//   const groups = res.groups;
//   if (!groups) {
//     throw SyntaxError(`Invalid assembly syntax at line ${lineNum}: ${line}`);
//   }
//   groups["line"] = line;
//   return groups as unknown as ParsedLine;
// }

// https://stackoverflow.com/questions/48172934/error-using-async-and-await-with-filereader
function webBlobToText(fileBlob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsText(fileBlob);
  });
}

// parseASM(fetch())
