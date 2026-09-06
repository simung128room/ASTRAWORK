/**
 * Client-Side Sandboxed JavaScript / TypeScript Evaluator
 * Runs exclusively in an isolated Web Worker.
 * All network (fetch, XHR, WebSocket, EventSource, sendBeacon),
 * storage (indexedDB, localStorage), and worker creation APIs are disabled and sealed.
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

    // Worker code that strips and freezes all dangerous APIs before user code executes
    const workerScript = `
      (function() {
        // 1. Permanently remove and lock down all networking, storage, and worker-spawning capabilities
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

        self.onmessage = function(e) {
          const logs = [];
          const customConsole = {
            log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
            error: (...args) => logs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
            warn: (...args) => logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
            info: (...args) => logs.push('[INFO] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
          };

          try {
            // Strip TypeScript annotations and keywords safely
            let cleanCode = e.data
              .replace(/interface\s+[A-Za-z0-9_]+\s*(\<[^\>]*\>)?\s*\{[\s\S]*?\}/g, "")
              .replace(/type\s+[A-Za-z0-9_]+\s*(\<[^\>]*\>)?\s*=[\s\S]*?;/g, "")
              .replace(/\bas\s+[A-Za-z0-9_<>[\]|&, ]+/g, "")
              .replace(/:\s*([A-Za-z0-9_<>\[\]|&\s,]+)(?=[=,);{])/g, "")
              .replace(/\b(public|private|protected|readonly)\s+/g, "");

            const runner = new Function(
              'console',
              '"use strict"; ' + cleanCode
            );

            const ret = runner(customConsole);
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
          error: errEvent.message || "เกิดข้อผิดพลาดในการประมวลผล Web Worker Sandbox",
          executionTimeMs: elapsed,
        });
      };

      worker.postMessage(code);
    } catch (e: any) {
      cleanup();
      resolve({
        success: false,
        output: "",
        error: `ไม่สามารถเริ่มต้น Web Worker ได้: ${e?.message || String(e)}`,
        executionTimeMs: (performance.now() - start).toFixed(2),
      });
    }
  });
}
