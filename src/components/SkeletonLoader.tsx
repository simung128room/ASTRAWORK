import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, FileCode, FileText, Image as ImageIcon, File, Brain, Cpu } from "lucide-react";

/**
 * MessageSkeleton: Displayed when the AI is thinking / waiting for the first streaming chunk.
 */
export const MessageSkeleton: React.FC = () => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full max-w-3xl py-2 space-y-4 select-none"
    >
      {/* Dynamic Thinking Badge */}
      <div className="flex items-center gap-2.5">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-950/40 border border-purple-800/50 text-purple-300 text-xs font-medium shadow-xs">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="w-3.5 h-3.5 flex items-center justify-center"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </motion.div>
          
          <span className="font-thai font-medium flex items-center gap-1">
            กำลังคิด
            <span className="inline-flex">
              <motion.span
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
              >
                .
              </motion.span>
              <motion.span
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
              >
                .
              </motion.span>
              <motion.span
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
              >
                .
              </motion.span>
            </span>
          </span>

          <span className="text-[10px] text-purple-400/80 font-mono pl-1 border-l border-purple-800/60">
            {seconds > 0 ? `${seconds}s` : "กำลังเริ่ม"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Brain className="w-3.5 h-3.5 animate-pulse text-purple-400" />
          <span className="font-thai text-zinc-400 hidden sm:inline">กำลังประมวลผลและเตรียมคำตอบ</span>
        </div>
      </div>

      {/* Shimmering Response Preview */}
      <div className="space-y-3 pt-1">
        <div className="h-4 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 rounded-md w-[85%] animate-pulse" />
        <div className="h-4 bg-gradient-to-r from-zinc-800 via-zinc-700/80 to-zinc-800 rounded-md w-[95%] animate-pulse" />
        <div className="h-4 bg-gradient-to-r from-zinc-800 via-zinc-700/80 to-zinc-800 rounded-md w-[68%] animate-pulse" />
      </div>

      {/* Code Block Skeleton */}
      <div className="rounded-xl border border-zinc-800 bg-[#121215] p-4 space-y-3 shadow-xs overflow-hidden relative">
        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
            <div className="h-3 w-16 bg-zinc-800 rounded ml-2 animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
            <Cpu className="w-3 h-3 text-purple-400 animate-spin" style={{ animationDuration: "6s" }} />
            <span className="font-mono">Generating Output...</span>
          </div>
        </div>
        <div className="space-y-2 pt-1 font-mono text-xs">
          <div className="h-3 bg-zinc-800 rounded w-[38%] animate-pulse" />
          <div className="h-3 bg-zinc-800/80 rounded w-[72%] pl-4 animate-pulse" />
          <div className="h-3 bg-zinc-800/80 rounded w-[58%] pl-4 animate-pulse" />
          <div className="h-3 bg-zinc-800 rounded w-[22%] animate-pulse" />
        </div>
      </div>

      {/* Paragraph 2 lines */}
      <div className="space-y-2 pt-1">
        <div className="h-4 bg-gradient-to-r from-zinc-800 via-zinc-700/80 to-zinc-800 rounded-md w-[78%] animate-pulse" />
        <div className="h-4 bg-gradient-to-r from-zinc-800 via-zinc-700/80 to-zinc-800 rounded-md w-[45%] animate-pulse" />
      </div>
    </motion.div>
  );
};

/**
 * FileSkeleton: Shimmer placeholder while a file is being read/parsed in dark theme.
 */
export const FileSkeleton: React.FC<{ name?: string }> = ({ name }) => {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-[#18181b] border border-zinc-800 rounded-xl animate-pulse min-w-[180px] max-w-xs shadow-xs">
      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
        <File className="w-4 h-4 text-zinc-400 animate-pulse" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3 bg-zinc-700 rounded w-[75%]" />
        <div className="h-2 bg-zinc-800 rounded w-[45%]" />
      </div>
    </div>
  );
};

/**
 * Helper to get icon for file type
 */
export const getFileIcon = (extension: string, type: string) => {
  const ext = extension.toLowerCase();
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext)) {
    return <ImageIcon className="w-4 h-4 text-emerald-400" />;
  }
  if (["js", "ts", "tsx", "jsx", "py", "html", "css", "json", "sql", "rs", "go", "cpp", "c", "java", "php", "sh", "yaml", "yml"].includes(ext)) {
    return <FileCode className="w-4 h-4 text-purple-400" />;
  }
  if (["txt", "md", "csv", "log", "doc", "docx", "pdf", "xlsx", "pptx"].includes(ext)) {
    return <FileText className="w-4 h-4 text-blue-400" />;
  }
  return <File className="w-4 h-4 text-zinc-400" />;
};
