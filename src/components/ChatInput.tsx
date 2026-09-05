import React, { useState, useRef, useEffect } from "react";
import { 
  Paperclip, 
  ArrowUp, 
  Square, 
  X,
  UploadCloud
} from "lucide-react";
import { FileAttachment, ZenThemeConfig } from "../types";
import { zenAudio } from "../utils/zenAudio";
import { motion, AnimatePresence } from "motion/react";
import { FileSkeleton, getFileIcon } from "./SkeletonLoader";

import { VoiceInputButton } from "./VoiceInputButton";

interface ChatInputProps {
  onSendMessage: (text: string, attachments?: FileAttachment[]) => void;
  onStopStreaming?: () => void;
  isStreaming: boolean;
  theme?: ZenThemeConfig;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  onClearChat?: () => void;
  selectedPersonaName?: string;
  isHeroMode?: boolean;
  currentModelId?: string;
  onSelectModel?: (modelId: string) => void;
}

const TYPEWRITER_SUGGESTIONS = [
  "เขียนโค้ด React + Tailwind หรือแก้บั๊ก...",
  "ช่วยเขียนฟังก์ชันและอธิบายโค้ดภาษาไทย...",
  "สร้างระบบ REST API และเชื่อมต่อ Database...",
  "เขียนโค้ด TSX ง่ายๆ หรือทำ Component...",
  "วิเคราะห์และ Optimize ประสิทธิภาพของโค้ด...",
  "สอนเขียนโปรแกรมตั้งแต่พื้นฐานจนถึงระดับสูง...",
];

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStopStreaming,
  isStreaming,
  isHeroMode = false,
}) => {
  const [input, setInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderText, setPlaceholderText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<{ id: string; name: string }[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Typewriter effect in pure Thai
  useEffect(() => {
    if (input) return;
    const currentFullText = TYPEWRITER_SUGGESTIONS[placeholderIndex];
    const typingSpeed = isDeleting ? 30 : 65;

    const timer = setTimeout(() => {
      if (!isDeleting) {
        setPlaceholderText(currentFullText.substring(0, placeholderText.length + 1));
        if (placeholderText.length + 1 >= currentFullText.length) {
          setTimeout(() => setIsDeleting(true), 2800);
        }
      } else {
        setPlaceholderText(currentFullText.substring(0, placeholderText.length - 1));
        if (placeholderText.length <= 0) {
          setIsDeleting(false);
          setPlaceholderIndex((prev) => (prev + 1) % TYPEWRITER_SUGGESTIONS.length);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [placeholderText, isDeleting, placeholderIndex, input]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;

    zenAudio.playSoftClick();
    onSendMessage(input.trim(), attachments);
    setInput("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Universal File Processor
  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    zenAudio.playSoftClick();

    fileArray.forEach((file) => {
      const tempId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const ext = file.name.split(".").pop() || "";
      const isImage = file.type.startsWith("image/");
      const isText =
        file.type.startsWith("text/") ||
        file.type === "application/json" ||
        [
          "txt", "md", "csv", "json", "js", "ts", "tsx", "jsx", "py", "html", "css",
          "scss", "sql", "rs", "go", "cpp", "c", "h", "java", "php", "sh", "bash",
          "yaml", "yml", "xml", "log", "env", "toml", "ini", "rb", "swift", "kt"
        ].includes(ext.toLowerCase());

      // Show skeleton loading state
      setLoadingFiles((prev) => [...prev, { id: tempId, name: file.name }]);

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              id: tempId,
              name: file.name,
              size: file.size,
              type: file.type,
              extension: ext,
              dataUrl: dataUrl,
              isImage: true,
              isText: false,
            },
          ]);
          setLoadingFiles((prev) => prev.filter((f) => f.id !== tempId));
        };
        reader.readAsDataURL(file);
      } else if (isText) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const textContent = event.target?.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              id: tempId,
              name: file.name,
              size: file.size,
              type: file.type || "text/plain",
              extension: ext,
              content: textContent,
              isImage: false,
              isText: true,
            },
          ]);
          setLoadingFiles((prev) => prev.filter((f) => f.id !== tempId));
        };
        reader.readAsText(file);
      } else {
        setTimeout(() => {
          setAttachments((prev) => [
            ...prev,
            {
              id: tempId,
              name: file.name,
              size: file.size,
              type: file.type || "application/octet-stream",
              extension: ext,
              isImage: false,
              isText: false,
            },
          ]);
          setLoadingFiles((prev) => prev.filter((f) => f.id !== tempId));
        }, 300);
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    zenAudio.playSoftClick();
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const hasTextOrFiles = Boolean(input.trim() || attachments.length > 0);

  return (
    <div
      className="w-full relative transition-all"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        accept="*/*"
      />

      {/* Drag & Drop Visual Overlay */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="absolute inset-0 z-50 bg-[#6055ea]/10 backdrop-blur-xs border-2 border-dashed border-[#6055ea] rounded-3xl flex items-center justify-center pointer-events-none"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg text-sm font-medium text-[#6055ea]">
              <UploadCloud className="w-5 h-5 animate-bounce" />
              <span>วางไฟล์ที่นี่เพื่ออัปโหลด</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments & Skeleton Loaders Row */}
      {(attachments.length > 0 || loadingFiles.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 mb-2 px-2 max-h-36 overflow-y-auto">
          {loadingFiles.map((f) => (
            <FileSkeleton key={f.id} name={f.name} />
          ))}

          {attachments.map((att) => (
            <motion.div
              key={att.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2 px-2.5 py-1.5 glass-card-interactive rounded-xl shadow-xs group text-xs text-zinc-200 transition-all"
            >
              {att.isImage && att.dataUrl ? (
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="w-7 h-7 rounded-md object-cover border border-white/10 shadow-xs"
                />
              ) : (
                <div className="p-1 rounded bg-white/5 border border-white/10 shrink-0">
                  {getFileIcon(att.extension, att.type)}
                </div>
              )}

              <div className="max-w-[120px] sm:max-w-[140px] truncate">
                <p className="font-medium text-zinc-200 truncate" title={att.name}>
                  {att.name}
                </p>
                <p className="text-[10px] text-zinc-400 font-mono">
                  {formatFileSize(att.size)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="ลบไฟล์"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* 0xAlpha Refined Capsule Input Container */}
      <motion.div
        layout
        transition={{ duration: 0.2 }}
        className={`relative flex items-center bg-[#18181b] border border-[#27272a] focus-within:border-zinc-700 rounded-full px-3.5 py-2 transition-all shadow-lg ${
          isHeroMode ? "min-h-[56px]" : "min-h-[50px]"
        }`}
      >
        {/* Left: Paperclip & Voice Buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="แนบไฟล์ / อัปโหลดรูปภาพ"
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded-full transition-all shrink-0 cursor-pointer active:scale-95"
          >
            <Paperclip className="w-5 h-5 -rotate-45" />
          </button>

          <VoiceInputButton
            onTranscript={(speechText) => {
              setInput((prev) => (prev ? `${prev} ${speechText}` : speechText));
              zenAudio.playSoftClick();
            }}
          />
        </div>

        {/* Center: Input / Textarea */}
        <div className="relative flex-1 flex items-center min-w-0 mx-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isHeroMode ? (placeholderText || "พิมพ์คำถาม หรือสั่งเขียนโค้ด...") : "พิมพ์ข้อความ หรือถามคำถาม..."}
            rows={1}
            className="font-thai w-full bg-transparent text-[15px] sm:text-[16px] text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none leading-relaxed py-1 px-2 font-normal"
            style={{ minHeight: "28px", maxHeight: "140px" }}
          />
        </div>

        {/* Right Action Button */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {isStreaming ? (
            <motion.button
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              type="button"
              onClick={onStopStreaming}
              title="หยุดการสร้างคำตอบ"
              className="font-inter w-8 h-8 rounded-full bg-white hover:bg-zinc-200 active:scale-95 text-black flex items-center justify-center transition-all cursor-pointer shadow-md"
            >
              <Square className="w-3.5 h-3.5 fill-black text-black" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!hasTextOrFiles}
              title="ส่งข้อความ"
              className={`font-inter w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                hasTextOrFiles
                  ? "bg-[#582be8] hover:bg-[#6b3ff5] text-white cursor-pointer active:scale-95 shadow-md"
                  : "bg-zinc-800 text-zinc-600 cursor-default"
              }`}
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Disclaimer in Thai */}
      <div className="text-center mt-3 mb-1">
        <p className="font-thai text-[12px] text-zinc-500 font-normal">
          จอม อาจแสดงข้อมูลคลาดเคลื่อนได้ กรุณาตรวจสอบข้อมูลสำคัญ
        </p>
      </div>
    </div>
  );
};
