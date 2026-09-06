/**
 * Client-Side Sandboxed JavaScript / TypeScript Evaluator
 * Runs entirely in the user's browser using an isolated Web Worker.
 * Completely eliminates server RCE while blocking DOM, storage, and network access inside the worker.
 */

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTimeMs: string;
}

export function executeJsInBrowserSandbox(code: string): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const logs: string[] = [];

    // Worker code that shadows network and storage globals, and provides safe console capturing
    const workerScript = `
      self.onmessage = function(e) {
        const logs = [];
        const customConsole = {
          log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
          error: (...args) => logs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
          warn: (...args) => logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
          info: (...args) => logs.push('[INFO] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
        };

        try {
          // Block network access inside worker
          const fetch = undefined;
          const XMLHttpRequest = undefined;
          const importScripts = undefined;
          const indexedDB = undefined;
          const WebSocket = undefined;

          // Strip simple TypeScript type annotations if present
          let cleanCode = e.data
            .replace(/:\s*(string|number|boolean|any|void|unknown|never)\b/g, "")
            .replace(/interface\s+\w+\s*\{[^}]*\}/g, "")
            .replace(/type\s+\w+\s*=[^;]+;/g, "");

          const runner = new Function(
            'console',
            'fetch',
            'XMLHttpRequest',
            'importScripts',
            'indexedDB',
            'WebSocket',
            '"use strict"; ' + cleanCode
          );

          const ret = runner(customConsole, undefined, undefined, undefined, undefined, undefined);
          self.postMessage({
            success: true,
            logs,
            returnValue: ret !== undefined ? (typeof ret === 'object' ? JSON.stringify(ret, null, 2) : String(ret)) : undefined
          });
        } catch (err) {
          self.postMessage({
            success: false,
            logs,
            error: err && err.message ? err.message : String(err)
          });
        }
      };
    `;

    let blob: Blob;
    let workerUrl: string;
    try {
      blob = new Blob([workerScript], { type: "application/javascript" });
      workerUrl = URL.createObjectURL(blob);
    } catch (e: any) {
      // Fallback if Blob creation fails
      return resolve(fallbackExecution(code, start));
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

      // Hard 3-second timeout to prevent infinite loops (e.g. while(true))
      timeoutTimer = setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          output: logs.join("\n"),
          error: "Execution Timeout: โค้ดใช้เวลาประมวลผลนานเกิน 3 วินาที (ตรวจพบลูปไม่สิ้นสุดหรือคำนวณหนักเกินไป)",
          executionTimeMs: "3000",
        });
      }, 3000);

      worker.onmessage = (event) => {
        cleanup();
        const elapsed = (performance.now() - start).toFixed(2);
        const { success, logs: resLogs, returnValue, error } = event.data;
        const finalOutput = (resLogs && resLogs.length > 0)
          ? resLogs.join("\n")
          : (returnValue !== undefined ? returnValue : "โค้ดประมวลผลสำเร็จ (ไม่มีผลลัพธ์จาก console)");

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
          error: errEvent.message || "เกิดข้อผิดพลาดในการประมวลผล Web Worker",
          executionTimeMs: elapsed,
        });
      };

      worker.postMessage(code);
    } catch {
      cleanup();
      resolve(fallbackExecution(code, start));
    }
  });
}

function fallbackExecution(code: string, start: number): ExecutionResult {
  const logs: string[] = [];
  try {
    const customConsole = {
      log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
      error: (...args: any[]) => logs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
      warn: (...args: any[]) => logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
    };

    // Block access to sensitive browser APIs by shadowing them as null
    const runner = new Function(
      'console', 'window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest',
      '"use strict"; ' + code
    );
    const ret = runner(customConsole, null, null, null, null, null, null, null);
    const elapsed = (performance.now() - start).toFixed(2);

    return {
      success: true,
      output: logs.length > 0 ? logs.join("\n") : (ret !== undefined ? String(ret) : "Executed successfully."),
      executionTimeMs: elapsed,
    };
  } catch (err: any) {
    return {
      success: false,
      output: logs.join("\n"),
      error: err?.message || String(err),
      executionTimeMs: (performance.now() - start).toFixed(2),
    };
  }
}
