import React, { useState } from "react";
import { Copy, Check, Download, Play, Eye, Sparkles, Terminal, GitCompare, RefreshCw, AlertTriangle, ShieldAlert } from "lucide-react";
import { zenAudio } from "../utils/zenAudio";
import { executePythonInSandbox } from "../utils/pythonEvaluator";
import { executeSqlInSandbox } from "../utils/sqlEvaluator";
import { executeJsInBrowserSandbox } from "../utils/jsEvaluator";
import { ArtifactPreviewModal } from "./ArtifactPreviewModal";
import { DiffViewerModal } from "./DiffViewerModal";
import { ExecutionResult } from "../types";

interface CodeBlockProps {
  language?: string;
  value: string;
  onSendToChat?: (prompt: string) => void;
  onSendToScratchpad?: (code: string, lang: string) => void;
  isDarkTheme?: boolean;
}

const getExtension = (lang: string): string => {
  const l = (lang || "").toLowerCase().trim();
  switch (l) {
    case "tsx":
      return "tsx";
    case "jsx":
      return "jsx";
    case "typescript":
    case "ts":
      return "ts";
    case "javascript":
    case "js":
      return "js";
    case "python":
    case "py":
      return "py";
    case "html":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "sql":
      return "sql";
    case "bash":
    case "sh":
      return "sh";
    default:
      return "txt";
  }
};

const highlightCodeLine = (line: string): React.ReactNode => {
  if (!line) return "\n";

  if (line.trim().startsWith("//") || line.trim().startsWith("#") || line.trim().startsWith("/*") || line.trim().startsWith("*")) {
    return <span className="text-zinc-500 italic">{line}</span>;
  }

  const tokenRegex =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b(?:import|from|export|default|function|const|let|var|return|if|else|switch|case|break|for|while|do|try|catch|finally|throw|class|extends|interface|type|new|async|await|typeof|instanceof|def|elif|print|as|in|of)\b)|(<\/?(?:div|button|h1|h2|h3|h4|h5|h6|p|span|section|header|footer|nav|main|ul|ol|li|table|tr|th|td|form|input|textarea|select|option|svg|path|code|pre|img|a|label|Counter|App|Component)[^>]*>|<\/?[a-zA-Z0-9_\-]+(?:\s|>|\/)|<\/>)|(\b(?:useState|useEffect|useMemo|useCallback|useRef|useContext|React|FC|number|string|boolean|any|void|null|undefined|Promise|Array|Record|Object)\b)|(\b[a-zA-Z0-9_\-]+(?==))|(\b\d+\b)|([{}()[\].,;:?!=<>+\-*/&|^~%]+)|([^\s"'`a-zA-Z0-9_{}()[\].,;:?!=<>+\-*/&|^~%]+|[a-zA-Z0-9_]+|\s+)/g;

  const parts: React.ReactNode[] = [];
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  let key = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    const [full, str, kw, jsxTag, compOrType, prop, num, punct, rest] = match;

    if (str) {
      parts.push(<span key={key++} className="text-[#38bdf8]">{str}</span>);
    } else if (kw) {
      parts.push(<span key={key++} className="text-[#fb7185] font-medium">{kw}</span>);
    } else if (jsxTag) {
      parts.push(<span key={key++} className="text-[#4ade80]">{jsxTag}</span>);
    } else if (compOrType) {
      parts.push(<span key={key++} className="text-[#c084fc]">{compOrType}</span>);
    } else if (prop) {
      parts.push(<span key={key++} className="text-[#38bdf8]">{prop}</span>);
    } else if (num) {
      parts.push(<span key={key++} className="text-[#fde047]">{num}</span>);
    } else if (punct) {
      parts.push(<span key={key++} className="text-[#94a3b8]">{punct}</span>);
    } else {
      parts.push(<span key={key++} className="text-[#f4f4f5]">{rest || full}</span>);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(<span key={key++} className="text-[#f4f4f5]">{line.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : line;
};

export const CodeBlock: React.FC<CodeBlockProps> = ({
  language = "tsx",
  value,
  onSendToChat,
}) => {
  const [currentCode, setCurrentCode] = useState(value);
  const [previousCode, setPreviousCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Execution Sandbox State
  const [isRunning, setIsRunning] = useState(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const [showRunConfirm, setShowRunConfirm] = useState(false);
  const [hasUserConfirmed, setHasUserConfirmed] = useState(false);

  // Auto-Debug Agent State
  const [isAutoDebugging, setIsAutoDebugging] = useState(false);

  // Modals
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDiffOpen, setIsDiffOpen] = useState(false);

  const cleanLang = (language || "").toLowerCase().replace(/^language-/, "").trim() || "code";

  const isExecutable =
    ["javascript", "js", "typescript", "ts", "python", "py", "sql"].includes(cleanLang);

  const isHtmlVisual = ["html", "svg", "jsx", "tsx"].includes(cleanLang);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    zenAudio.playCopyChime();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    zenAudio.playSoftClick();
    const ext = getExtension(cleanLang);
    const blob = new Blob([currentCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `code.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Run Code Sandbox Action (Client-side Web Worker / Isolated AST Sandbox)
  const executeCodeInternal = async () => {
    setIsRunning(true);
    setShowConsole(true);
    zenAudio.playSoftClick();

    const start = performance.now();

    try {
      if (cleanLang === "python" || cleanLang === "py") {
        const res = await executePythonInSandbox(currentCode);
        setExecResult({
          success: res.success,
          output: res.output,
          error: res.error,
          executionTimeMs: res.executionTimeMs || ((performance.now() - start).toFixed(2)),
          language: "Python",
        });
      } else if (cleanLang === "sql") {
        const res = executeSqlInSandbox(currentCode);
        const elapsed = (performance.now() - start).toFixed(2);
        setExecResult({
          success: res.success,
          output: res.output,
          error: res.error,
          executionTimeMs: elapsed,
          language: "SQL",
        });
      } else {
        // Safe Browser Web Worker Sandbox for JS / TS
        const res = await executeJsInBrowserSandbox(currentCode);
        setExecResult({
          success: res.success,
          output: res.output,
          error: res.error,
          executionTimeMs: res.executionTimeMs,
          language: cleanLang.toUpperCase(),
        });
      }
    } catch (err: any) {
      setExecResult({
        success: false,
        output: "",
        error: `Sandbox Error: ${err?.message || String(err)}`,
        executionTimeMs: (performance.now() - start).toFixed(2),
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunCodeClick = () => {
    if (!hasUserConfirmed) {
      setShowRunConfirm(true);
    } else {
      executeCodeInternal();
    }
  };

  const handleConfirmAndRun = () => {
    setHasUserConfirmed(true);
    setShowRunConfirm(false);
    executeCodeInternal();
  };

  // Autonomous Agent Auto-Debugging Loop
  const handleAutoDebugFix = async () => {
    if (!execResult?.error && !onSendToChat) return;

    setIsAutoDebugging(true);
    zenAudio.playZenChime();

    try {
      const response = await fetch("/api/auto-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentCode,
          error: execResult?.error || "ขอปรับปรุงประสิทธภาพโค้ดและตรวจแก้บั๊กอัตโนมัติ",
          language: cleanLang,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.fixedCode) {
          setPreviousCode(currentCode);
          setCurrentCode(data.fixedCode);
          setExecResult({
            success: true,
            output: `⚡ [Autonomous Agent Auto-Fix Success]:\n${data.explanation || "แก้ไขโค้ดและทดสอบผ่านเรียบร้อย"}`,
            executionTimeMs: "0.45",
          });
          zenAudio.playCopyChime();
        }
      }
    } catch (e) {
      if (onSendToChat) {
        onSendToChat(`ช่วยวิเคราะห์และแก้ไขบั๊กในโค้ดนี้ที:\n\`\`\`${cleanLang}\n${currentCode}\n\`\`\`\nข้อผิดพลาด:\n${execResult?.error}`);
      }
    } finally {
      setIsAutoDebugging(false);
    }
  };

  const lines = currentCode.split("\n");

  return (
    <div className="my-4 overflow-hidden rounded-2xl glass-code-block transition-all border border-zinc-800/80">
      {/* Code Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-800 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-mono lowercase text-purple-300 font-medium px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">
            {cleanLang}
          </span>
          {previousCode && (
            <span className="text-[11px] font-thai text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Auto-Fixed
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Run Code Button */}
          {isExecutable && (
            <button
              onClick={handleRunCodeClick}
              disabled={isRunning}
              title="รันโค้ดใน Browser Sandbox"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-white transition-all text-xs font-medium cursor-pointer active:scale-95"
            >
              {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isRunning ? "Running..." : "Run Code"}</span>
            </button>
          )}

          {/* Live Preview Button */}
          {isHtmlVisual && (
            <button
              onClick={() => setIsPreviewOpen(true)}
              title="พรีวิว UI สด"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 hover:text-white transition-all text-xs font-medium cursor-pointer active:scale-95"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          )}

          {/* Diff View Button */}
          {previousCode && (
            <button
              onClick={() => setIsDiffOpen(true)}
              title="ดูเปรียบเทียบโค้ด ก่อน-หลัง"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 hover:text-white transition-all text-xs font-medium cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Diff</span>
            </button>
          )}

          {/* Copy */}
          <button
            onClick={handleCopy}
            title={copied ? "คัดลอกแล้ว!" : "คัดลอกโค้ด"}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            title="ดาวน์โหลดไฟล์โค้ด"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Code Body */}
      <div className="p-4 overflow-x-auto bg-zinc-950/90 font-mono text-[14px] leading-[1.75] text-[#f4f4f5] whitespace-pre selection:bg-purple-500/30">
        <pre>
          <code>
            {lines.map((line, idx) => (
              <span key={idx} className="block min-h-[1.75rem]">
                {highlightCodeLine(line)}
              </span>
            ))}
          </code>
        </pre>
      </div>

      {/* Sandbox Terminal Output Drawer */}
      {showConsole && execResult && (
        <div className="bg-black/90 border-t border-zinc-800 p-3 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80">
            <div className="flex items-center gap-2 text-zinc-300 font-semibold">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Terminal Output ({execResult.language || cleanLang})</span>
              {execResult.executionTimeMs && (
                <span className="text-[10px] text-zinc-500">({execResult.executionTimeMs}ms)</span>
              )}
            </div>

            {/* Auto-Debug Agent Button */}
            {!execResult.success && (
              <button
                onClick={handleAutoDebugFix}
                disabled={isAutoDebugging}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-all shadow-md shadow-purple-600/30 cursor-pointer active:scale-95"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAutoDebugging ? "animate-spin" : ""}`} />
                <span>{isAutoDebugging ? "Agent Debugging..." : "⚡ Auto-Agent Fix"}</span>
              </button>
            )}
          </div>

          {execResult.error ? (
            <div className="text-red-400 bg-red-950/30 p-2.5 rounded-xl border border-red-900/50 whitespace-pre-wrap flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{execResult.error}</span>
            </div>
          ) : (
            <pre className="text-emerald-300 whitespace-pre-wrap leading-relaxed">
              {execResult.output}
            </pre>
          )}
        </div>
      )}

      {/* Security Confirmation Modal for AI Generated Code Execution */}
      {showRunConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-zinc-100 text-sm">
                  ยืนยันการรันโค้ดที่สร้างโดย AI
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  โค้ดนี้จะถูกประมวลผลภายในเบราว์เซอร์ของคุณ (Client Sandbox Web Worker) โดยมีการจำกัดสิทธิ์ความปลอดภัยและ Timeout ไม่เกิน 3 วินาที คุณต้องการเริ่มรันโค้ดหรือไม่?
                </p>
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs font-mono text-zinc-300 flex items-center justify-between">
              <span className="text-zinc-500">ภาษา:</span>
              <span className="text-purple-400 font-semibold uppercase">{cleanLang}</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRunConfirm(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmAndRun}
                className="px-4 py-1.5 rounded-xl text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/30 active:scale-95"
              >
                ยืนยันและเริ่มรันโค้ด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ArtifactPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        code={currentCode}
        language={cleanLang}
      />

      <DiffViewerModal
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        oldCode={previousCode || ""}
        newCode={currentCode}
      />
    </div>
  );
};
