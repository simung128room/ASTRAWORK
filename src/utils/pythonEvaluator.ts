/**
 * Client-Side Sandboxed Python Evaluator
 * Runs exclusively in an isolated Web Worker with all network and storage APIs locked down.
 * Prevents main-thread XSS, prototype pollution, and data exfiltration.
 */

export interface PythonExecutionResult {
  output: string;
  success: boolean;
  error?: string;
  executionTimeMs?: string;
}

export function executePythonInSandbox(code: string): Promise<PythonExecutionResult> {
  return new Promise((resolve) => {
    const start = performance.now();

    // Isolated Web Worker Script for Python parsing and execution
    const workerScript = `
      (function() {
        // Lockdown all networking, storage, and worker APIs
        const dangerousGlobals = [
          'fetch',
          'XMLHttpRequest',
          'WebSocket',
          'EventSource',
          'importScripts',
          'indexedDB',
          'openDatabase',
          'BroadcastChannel',
          'SharedWorker',
          'Worker'
        ];

        for (const key of dangerousGlobals) {
          try {
            Object.defineProperty(self, key, {
              value: undefined,
              writable: false,
              configurable: false,
            });
            Object.defineProperty(globalThis, key, {
              value: undefined,
              writable: false,
              configurable: false,
            });
          } catch (e) {}
        }

        if (self.navigator) {
          try {
            Object.defineProperty(self.navigator, 'sendBeacon', {
              value: undefined,
              writable: false,
              configurable: false,
            });
          } catch (e) {}
        }

        function transpilePythonToJs(pyCode) {
          const lines = pyCode.split('\\n');
          const jsLines = [];
          const indentStack = [0];

          for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            if (!rawLine.trim() || rawLine.trim().startsWith('#')) {
              continue;
            }

            const currentIndent = rawLine.search(/\\S/);
            while (indentStack.length > 1 && currentIndent < indentStack[indentStack.length - 1]) {
              indentStack.pop();
              jsLines.push('}');
            }

            let line = rawLine.trim();

            // Transform print
            line = line.replace(/print\\s*\\((.*?)\\)/g, function(_, args) {
              return '__print(' + (args || '') + ')';
            });

            // Booleans & Null
            line = line.replace(/\\bTrue\\b/g, 'true')
                       .replace(/\\bFalse\\b/g, 'false')
                       .replace(/\\bNone\\b/g, 'null');

            // Transformations
            if (/^def\\s+([a-zA-Z0-9_]+)\\s*\\((.*?)\\):$/.test(line)) {
              line = line.replace(/^def\\s+([a-zA-Z0-9_]+)\\s*\\((.*?)\\):$/, 'function $1($2) {');
              indentStack.push(currentIndent + 1);
            } else if (/^if\\s+(.*?):$/.test(line)) {
              line = line.replace(/^if\\s+(.*?):$/, 'if ($1) {');
              indentStack.push(currentIndent + 1);
            } else if (/^elif\\s+(.*?):$/.test(line)) {
              line = line.replace(/^elif\\s+(.*?):$/, '} else if ($1) {');
            } else if (/^else\\s*:$/.test(line)) {
              line = '} else {';
            } else if (/^for\\s+([a-zA-Z0-9_]+)\\s+in\\s+range\\((.*?)\\):$/.test(line)) {
              const m = line.match(/^for\\s+([a-zA-Z0-9_]+)\\s+in\\s+range\\((.*?)\\):$/);
              const v = m[1];
              const r = m[2].split(',').map(s => s.trim());
              if (r.length === 1) {
                line = 'for (let ' + v + ' = 0; ' + v + ' < ' + r[0] + '; ' + v + '++) {';
              } else if (r.length === 2) {
                line = 'for (let ' + v + ' = ' + r[0] + '; ' + v + ' < ' + r[1] + '; ' + v + '++) {';
              } else {
                line = 'for (let ' + v + ' = ' + r[0] + '; ' + v + ' < ' + r[1] + '; ' + v + ' += ' + r[2] + ') {';
              }
              indentStack.push(currentIndent + 1);
            } else if (/^while\\s+(.*?):$/.test(line)) {
              line = line.replace(/^while\\s+(.*?):$/, 'while ($1) {');
              indentStack.push(currentIndent + 1);
            }

            // len(x) -> (x && x.length !== undefined ? x.length : Object.keys(x).length)
            line = line.replace(/len\\((.*?)\\)/g, '($1 ? ($1.length !== undefined ? $1.length : Object.keys($1).length) : 0)');

            // str(x) -> String(x), int(x) -> parseInt(x), float(x) -> parseFloat(x)
            line = line.replace(/\\bstr\\((.*?)\\)/g, 'String($1)')
                       .replace(/\\bint\\((.*?)\\)/g, 'parseInt($1, 10)')
                       .replace(/\\bfloat\\((.*?)\\)/g, 'parseFloat($1)');

            jsLines.push(line);
          }

          while (indentStack.length > 1) {
            indentStack.pop();
            jsLines.push('}');
          }

          return jsLines.join('\\n');
        }

        self.onmessage = function(e) {
          const logs = [];
          const printFn = function(...args) {
            logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
          };

          try {
            const pyCode = e.data;
            const transpiled = transpilePythonToJs(pyCode);

            const runner = new Function('__print', '"use strict";\\n' + transpiled);
            runner(printFn);

            self.postMessage({
              success: true,
              logs: logs,
            });
          } catch (err) {
            self.postMessage({
              success: false,
              logs: logs,
              error: err && err.message ? err.message : String(err)
            });
          }
        };
      })();
    `;

    let blob: Blob;
    let workerUrl: string;
    try {
      blob = new Blob([workerScript], { type: "application/javascript" });
      workerUrl = URL.createObjectURL(blob);
    } catch {
      return resolve({
        success: false,
        output: "",
        error: "ไม่สามารถสร้าง Web Worker สำหรับ Sandbox ได้ เพื่อความปลอดภัยระบบจะไม่รันโค้ดบน Main Thread",
        executionTimeMs: "0.00",
      });
    }

    let worker: Worker | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (worker) {
        worker.terminate();
        worker = null;
      }
      try {
        URL.revokeObjectURL(workerUrl);
      } catch {}
    };

    try {
      worker = new Worker(workerUrl);

      timeoutTimer = setTimeout(() => {
        cleanup();
        const elapsed = (performance.now() - start).toFixed(2);
        resolve({
          success: false,
          output: "",
          error: "Python Execution Timeout: การประมวลผลนานเกิน 3 วินาที",
          executionTimeMs: elapsed,
        });
      }, 3000);

      worker.onmessage = (event) => {
        cleanup();
        const elapsed = (performance.now() - start).toFixed(2);
        const { success, logs, error } = event.data;
        const finalOutput = logs && logs.length > 0 ? logs.join("\n") : "Python code executed successfully (no output).";

        resolve({
          success,
          output: finalOutput,
          error,
          executionTimeMs: elapsed,
        });
      };

      worker.onerror = (errEvent) => {
        cleanup();
        const elapsed = (performance.now() - start).toFixed(2);
        resolve({
          success: false,
          output: "",
          error: errEvent.message || "เกิดข้อผิดพลาดในการประมวลผล Python Sandbox",
          executionTimeMs: elapsed,
        });
      };

      worker.postMessage(code);
    } catch (e: any) {
      cleanup();
      resolve({
        success: false,
        output: "",
        error: `ไม่สามารถเริ่มต้น Python Web Worker: ${e?.message || String(e)}`,
        executionTimeMs: (performance.now() - start).toFixed(2),
      });
    }
  });
}
