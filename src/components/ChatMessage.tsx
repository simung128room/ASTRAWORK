import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Message, ZenThemeConfig } from "../types";
import { CodeBlock } from "./CodeBlock";
import { ClaudeQuestionSheet, QuestionData } from "./ClaudeQuestionSheet";
import { 
  Copy, 
  Check, 
  RotateCcw, 
  Edit3, 
  ThumbsUp, 
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Volume2,
  VolumeX,
  Globe,
  ExternalLink,
  X
} from "lucide-react";
import { zenAudio } from "../utils/zenAudio";
import { motion } from "motion/react";
import { getFileIcon } from "./SkeletonLoader";

interface ChatMessageProps {
  message: Message;
  theme?: ZenThemeConfig;
  onSendToChat?: (prompt: string) => void;
  onSendToScratchpad?: (code: string, lang: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEditAndResend?: (content: string) => void;
}

// Dynamic Thinking Counter Component
const ThinkingTimer: React.FC<{ startTimestamp?: number }> = ({ startTimestamp }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const startTime = startTimestamp || Date.now();
    const calculateDiff = () => Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    
    setSeconds(calculateDiff());

    const interval = setInterval(() => {
      setSeconds(calculateDiff());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTimestamp]);

  return (
    <div className="py-2 select-none">
      <span className="text-zinc-400 text-[15px] font-normal tracking-wide animate-pulse font-sans">
        {seconds > 4 ? `Thinking for ${seconds}s...` : "Thinking..."}
      </span>
    </div>
  );
};

// Lightweight Inline Thought Process Accordion (No Bottom Sheet / No Modal)
const ThoughtProcessModal: React.FC<{ content: string; isStreaming?: boolean }> = ({ content, isStreaming }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!content || !content.trim()) return null;

  // Split content into points / steps
  const rawLines = content.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const steps = rawLines.map(line => line.replace(/^[-*•\d.\s]+/, "").trim()).filter(Boolean);

  const displaySteps = steps.length > 0 ? steps : [content.trim()];
  const latestStep = displaySteps[displaySteps.length - 1];

  return (
    <div className="mb-3">
      {/* Inline Thought Process Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors select-none cursor-pointer py-1 px-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500/90 group-hover:bg-orange-400 transition-colors shrink-0" />
        <span className="font-thai truncate max-w-sm sm:max-w-md font-medium text-zinc-300">
          {displaySteps.length > 1 ? latestStep : "Thought process"}
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {/* Inline Expandable View (No Fullscreen / No Bottom Sheet Modal) */}
      {isOpen && (
        <div className="mt-2 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs text-zinc-300 font-thai">
          {displaySteps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500/90 mt-1.5 shrink-0" />
              <p className="leading-relaxed text-zinc-300">{step}</p>
            </div>
          ))}

          {isStreaming && (
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse mt-1.5 shrink-0" />
              <p className="text-zinc-400 italic">Thinking...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper to extract <thinking> tags and question data (Claude style)
export interface ParsedMessageData {
  thinking: string;
  main: string;
  questionData: QuestionData | null;
}

export const extractThinkingMainAndQuestion = (content: string): ParsedMessageData => {
  let thinking = "";
  let main = content || "";

  // 1. Extract <thinking> tags
  if (main.includes("<thinking>")) {
    const parts = main.split("<thinking>");
    const afterThinking = parts[1] || "";
    if (afterThinking.includes("</thinking>")) {
      const thinkingParts = afterThinking.split("</thinking>");
      thinking = thinkingParts[0].trim();
      main = (parts[0] + thinkingParts.slice(1).join("</thinking>")).trim();
    } else {
      // Still streaming inside thinking tag
      thinking = afterThinking.trim();
      main = parts[0].trim();
    }
  }

  let questionData: QuestionData | null = null;

  // 2. Extract explicit <question title="..."> <option>...</option> </question>
  const questionTagRegex = /<question(?:\s+title=["']([^"']*)["'])?\s*>([\s\S]*?)<\/question>/i;
  const qMatch = questionTagRegex.exec(main);
  if (qMatch) {
    const title = qMatch[1]?.trim() || "อยากได้แบบไหน?";
    const inner = qMatch[2];
    const optionRegex = /<option>([\s\S]*?)<\/option>/gi;
    const options: string[] = [];
    let optMatch;
    while ((optMatch = optionRegex.exec(inner)) !== null) {
      const text = optMatch[1].trim();
      if (text) options.push(text);
    }
    if (options.length > 0) {
      questionData = { title, options };
      main = main.replace(questionTagRegex, "").trim();
    }
  }

  return { thinking, main, questionData };
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onSendToChat,
  onSendToScratchpad,
  onRegenerate,
  onEditAndResend,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const toggleSpeech = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      console.warn("SpeechSynthesis API is not supported in this browser environment");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      try {
        window.speechSynthesis.cancel();
        const textToSpeak = message.content.replace(/```[\s\S]*?```/g, " [โค้ด] ").slice(0, 1000);
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = "th-TH";
        utterance.rate = 1.0;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
      } catch (e) {
        console.warn("TTS error:", e);
        setIsSpeaking(false);
      }
    }
  };

  const isAssistant = message.role === "assistant";
  const isThinking = isAssistant && (!message.content || message.content.trim() === "");

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    zenAudio.playCopyChime();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && onEditAndResend) {
      onEditAndResend(editContent.trim());
      setIsEditing(false);
    }
  };

  // 1. Assistant Message
  if (isAssistant) {
    const { thinking, main, questionData } = extractThinkingMainAndQuestion(message.content);

    return (
      <motion.div
        id={`msg-${message.id}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex w-full justify-start items-start my-5 group"
      >
        <div className="flex-1 max-w-3xl min-w-0">
          {/* Thought Process Modal Trigger if CoT present */}
          {thinking && <ThoughtProcessModal content={thinking} isStreaming={isThinking} />}

          {/* Thinking State */}
          {isThinking ? (
            <ThinkingTimer startTimestamp={message.timestamp} />
          ) : (
            <div className="text-[16px] leading-[1.8] text-zinc-100 font-normal">
              <ReactMarkdown
                components={{
                  pre({ children }) {
                    return <>{children}</>;
                  },
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeString = String(children).replace(/\n$/, "");

                    if (match) {
                      return (
                        <CodeBlock
                          language={match[1]}
                          value={codeString}
                          onSendToChat={onSendToChat}
                          onSendToScratchpad={onSendToScratchpad}
                        />
                      );
                    }

                    return (
                      <code
                        className="bg-white/[0.06] backdrop-blur-md px-2 py-0.5 rounded-md text-[13.5px] font-mono text-purple-300 border border-white/[0.1] shadow-xs"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  p({ children }) {
                    return <p className="font-thai mb-4 leading-[1.8] last:mb-0 text-zinc-100/90 font-normal text-[16px]">{children}</p>;
                  },
                  ul({ children }) {
                    return <ul className="font-thai list-disc pl-5 mb-4 space-y-2 text-zinc-100/90">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="font-thai list-decimal pl-5 mb-4 space-y-2 text-zinc-100/90">{children}</ol>;
                  },
                  li({ children }) {
                    return (
                      <li className="font-thai leading-[1.8] text-zinc-100/90">
                        {children}
                      </li>
                    );
                  },
                  a({ href, children }: any) {
                    if (href?.startsWith("#prompt=")) {
                      return null;
                    }
                    if (href === "#send" && onSendToChat) {
                      const promptText = typeof children === "string" ? children : String(children);
                      return (
                        <button
                          type="button"
                          onClick={() => onSendToChat(promptText)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 my-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 hover:text-white transition-all text-sm font-medium cursor-pointer active:scale-95 shadow-xs"
                        >
                          <span>{children}</span>
                          <span className="text-xs text-purple-400">↵</span>
                        </button>
                      );
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-400 hover:underline font-medium"
                      >
                        {children}
                      </a>
                    );
                  },
                  h1({ children }) {
                    return <h1 className="font-prompt text-[26px] sm:text-[28px] font-semibold text-white mt-6 mb-3 tracking-tight drop-shadow-sm">{children}</h1>;
                  },
                  h2({ children }) {
                    return <h2 className="font-prompt text-[21px] sm:text-[22px] font-medium text-white mt-5 mb-2.5 tracking-tight drop-shadow-sm">{children}</h2>;
                  },
                  h3({ children }) {
                    return <h3 className="font-prompt text-[18px] sm:text-[19px] font-medium text-white mt-4 mb-2 tracking-tight drop-shadow-sm">{children}</h3>;
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="font-thai border-l-2 border-purple-400/80 pl-4 my-3 italic text-zinc-200 bg-white/[0.03] backdrop-blur-md py-2.5 rounded-r-xl border-y border-r border-white/[0.04]">
                        {children}
                      </blockquote>
                    );
                  },
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md">
                        <table className="min-w-full divide-y divide-white/[0.08] text-sm">
                          {children}
                        </table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return (
                      <th className="px-4 py-2.5 bg-white/[0.04] font-medium text-zinc-200 text-left">
                        {children}
                      </th>
                    );
                  },
                  td({ children }) {
                    return (
                      <td className="px-4 py-2.5 border-t border-white/[0.06] text-zinc-300">
                        {children}
                      </td>
                    );
                  },
                }}
              >
                {main}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-2 h-4.5 bg-purple-400 ml-1.5 align-middle animate-pulse rounded-xs shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
              )}
            </div>
          )}

          {/* Google Search Grounding Sources */}
          {message.searchSources && message.searchSources.length > 0 && (
            <div className="mt-3 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-purple-400 font-semibold">
                <Globe className="w-3.5 h-3.5" />
                <span>Google Search Sources ({message.searchSources.length})</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {message.searchSources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-purple-300 transition-colors"
                  >
                    <span className="truncate max-w-[180px]">{src.title || src.url}</span>
                    <ExternalLink className="w-3 h-3 text-zinc-500" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Assistant Actions Bar */}
          {!isThinking && message.content && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 mt-3 pt-1 text-zinc-500 text-xs"
            >
              {/* Voice TTS Speaker */}
              <button
                onClick={toggleSpeech}
                title={isSpeaking ? "หยุดอ่านออกเสียง" : "อ่านออกเสียง (Voice TTS)"}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isSpeaking ? "text-purple-400 bg-purple-500/15 animate-pulse" : "hover:text-zinc-200 hover:bg-white/[0.06]"
                }`}
              >
                {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Copy */}
              <button
                onClick={handleCopy}
                title="คัดลอกข้อความ"
                className="p-1.5 rounded-lg hover:text-zinc-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              {/* Thumbs Up */}
              <button
                onClick={() => {
                  setLiked(liked === true ? null : true);
                  zenAudio.playSoftClick();
                }}
                title="คำตอบมีประโยชน์"
                className={`p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer ${
                  liked === true ? "text-purple-400" : "hover:text-zinc-200"
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
              </button>

              {/* Thumbs Down */}
              <button
                onClick={() => {
                  setLiked(liked === false ? null : false);
                  zenAudio.playSoftClick();
                }}
                title="คำตอบยังไม่ดีพอ"
                className={`p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer ${
                  liked === false ? "text-red-400" : "hover:text-zinc-200"
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
              </button>

              {/* Regenerate */}
              {onRegenerate && !message.isStreaming && (
                <button
                  onClick={() => onRegenerate(message.id)}
                  title="สร้างคำตอบใหม่"
                  className="p-1.5 rounded-lg hover:text-zinc-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  // 2. User Message: Liquid Glass Purple Pill Bubble with Specular Refraction
  return (
    <motion.div
      id={`msg-${message.id}`}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex w-full justify-end items-start my-4 group"
    >
      <div className="flex flex-col items-end max-w-xl">
        {/* Attached Files */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 justify-end">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-3 py-1.5 glass-card-interactive rounded-xl shadow-xs text-xs text-zinc-200"
              >
                {att.isImage && att.dataUrl ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="w-7 h-7 rounded-md object-cover border border-white/10"
                  />
                ) : (
                  <div className="p-1 rounded bg-white/5 border border-white/10">
                    {getFileIcon(att.extension, att.type)}
                  </div>
                )}
                <div className="max-w-[150px] truncate text-left">
                  <p className="font-medium truncate" title={att.name}>
                    {att.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    {formatFileSize(att.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User Capsule Pill Bubble or Edit Box Container */}
        {isEditing ? (
          <div className="w-full max-w-lg bg-[#141417] border border-[#27272a] rounded-2xl p-4 shadow-xl text-white">
            <div className="flex items-start justify-between gap-2 mb-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                autoFocus
                className="font-thai w-full bg-transparent text-[15px] sm:text-[16px] text-white focus:outline-none resize-none leading-relaxed placeholder:text-zinc-600"
              />
              <div className="p-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 shrink-0">
                <Edit3 className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="font-inter px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="font-inter px-5 py-2 bg-[#6236f5] hover:bg-[#7248f7] text-white text-sm font-medium rounded-xl transition-all cursor-pointer shadow-md shadow-[#6236f5]/25 active:scale-95"
              >
                บันทึก & ส่งใหม่
              </button>
            </div>
          </div>
        ) : (
          <div className="relative group/bubble flex items-center justify-end w-fit">
            <div className="w-fit max-w-full px-6 py-2.5 sm:px-7 sm:py-3 bg-[#6236f5] text-white rounded-full sm:rounded-[28px] text-[15px] sm:text-[16px] font-normal leading-normal transition-all shadow-md shadow-[#6236f5]/20 flex items-center gap-2">
              <div className="font-thai text-white flex items-center justify-between gap-3 w-fit">
                <span className="whitespace-pre-wrap break-words">{message.content}</span>
                {onEditAndResend && (
                  <button
                    onClick={() => {
                      setEditContent(message.content);
                      setIsEditing(true);
                    }}
                    title="แก้ไขข้อความ"
                    className="opacity-30 hover:opacity-100 transition-opacity p-0.5 text-white cursor-pointer shrink-0 -mr-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Copy button below */}
        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            title="คัดลอก"
            className="p-1 rounded-md hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
