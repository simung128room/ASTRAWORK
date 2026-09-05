// Lightweight JS-based Python Code Simulator for Instant Browser Sandbox Execution
export function executePythonInSandbox(code: string): { output: string; success: boolean; error?: string } {
  const logs: string[] = [];

  try {
    // Basic Python to JS transformer for simple algorithms
    let jsCode = code
      // print(...) -> console.log(...)
      .replace(/print\s*\((.*?)\)/g, (_, args) => `__print(${args})`)
      // True / False / None -> true / false / null
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null")
      // def func(a, b): -> function func(a, b) {
      .replace(/def\s+([a-zA-Z0-9_]+)\s*\((.*?)\):/g, "function $1($2) {")
      // for i in range(n): -> for (let i = 0; i < n; i++) {
      .replace(/for\s+([a-zA-Z0-9_]+)\s+in\s+range\((.*?)\):/g, (_, varName, rangeArg) => {
        const parts = rangeArg.split(",").map((s: string) => s.trim());
        if (parts.length === 1) {
          return `for (let ${varName} = 0; ${varName} < ${parts[0]}; ${varName}++) {`;
        } else if (parts.length === 2) {
          return `for (let ${varName} = ${parts[0]}; ${varName} < ${parts[1]}; ${varName}++) {`;
        }
        return `for (let ${varName} = ${parts[0]}; ${varName} < ${parts[1]}; ${varName} += ${parts[2]}) {`;
      })
      // elif condition: -> } else if (condition) {
      .replace(/elif\s+(.*?):/g, "} else if ($1) {")
      // if condition: -> if (condition) {
      .replace(/if\s+(.*?):/g, "if ($1) {")
      // else: -> } else {
      .replace(/else:/g, "} else {")
      // len(x) -> x.length
      .replace(/len\((.*?)\)/g, "$1.length");

    // Close Python indented blocks conceptually or execute JS
    const printFn = (...args: any[]) => {
      logs.push(args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
    };

    const runFunc = new Function("__print", `"use strict"; ${jsCode}`);
    runFunc(printFn);

    return {
      success: true,
      output: logs.length > 0 ? logs.join("\n") : "Python code executed successfully.",
    };
  } catch (err: any) {
    return {
      success: false,
      output: logs.join("\n"),
      error: `Python Execution Error: ${err?.message || String(err)}`,
    };
  }
}
