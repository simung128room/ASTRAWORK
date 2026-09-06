import React, { useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface QuestionData {
  title: string;
  options: string[];
}

interface ClaudeQuestionSheetProps {
  question: QuestionData;
  onSelectOption: (option: string) => void;
  onDismiss?: () => void;
}

export const ClaudeQuestionSheet: React.FC<ClaudeQuestionSheetProps> = ({
  question,
  onSelectOption,
  onDismiss,
}) => {
  const [customAnswer, setCustomAnswer] = useState("");

  if (!question.options || question.options.length === 0) {
    return null;
  }

  const handleSelect = (option: string) => {
    onSelectOption(option);
  };

  const handleCustomSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (customAnswer.trim()) {
      onSelectOption(customAnswer.trim());
      setCustomAnswer("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.98 }}
      transition={{ 
        type: "spring", 
        stiffness: 380, 
        damping: 28,
        mass: 0.8
      }}
      className="w-full bg-[#1b1b1e] border border-zinc-800/90 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-black/80 font-thai text-left overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-1">
        <motion.h3 
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 }}
          className="text-[17px] sm:text-[18px] font-semibold text-zinc-100 font-thai tracking-tight"
        >
          {question.title || "อยากได้แบบไหน?"}
        </motion.h3>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer active:scale-95"
            title="ปิดหน้าต่างสอบถามเพื่อกลับไปใช้ช่องพิมพ์ปกติ"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Options List */}
      <div className="space-y-0.5">
        {question.options.map((option, idx) => (
          <motion.button
            key={idx}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 + idx * 0.04, duration: 0.2 }}
            onClick={() => handleSelect(option)}
            className="w-full flex items-center gap-3.5 py-3 px-3 -mx-1 rounded-2xl hover:bg-zinc-800/60 active:bg-zinc-800/90 transition-all text-left cursor-pointer group border-b border-zinc-800/50 last:border-b-0"
          >
            {/* Numbered circular badge matching Claude style */}
            <div className="w-7 h-7 rounded-full bg-zinc-800 group-hover:bg-zinc-700 text-zinc-300 group-hover:text-white font-semibold text-xs flex items-center justify-center shrink-0 transition-colors shadow-xs">
              {idx + 1}
            </div>
            {/* Option text */}
            <span className="text-[14.5px] sm:text-[15.5px] text-zinc-200 group-hover:text-white font-thai leading-snug flex-1 transition-colors">
              {option}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Bottom custom answer input */}
      <form
        onSubmit={handleCustomSubmit}
        className="mt-3 pt-2.5 flex items-center gap-2 border-t border-zinc-800/80"
      >
        <input
          type="text"
          value={customAnswer}
          onChange={(e) => setCustomAnswer(e.target.value)}
          placeholder="Type your own answer..."
          className="flex-1 bg-transparent px-2 py-1.5 text-[14.5px] text-zinc-200 placeholder-zinc-500 focus:outline-none font-thai"
          autoFocus={false}
        />
        <button
          type="submit"
          disabled={!customAnswer.trim()}
          title="ส่งคำตอบ"
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
            customAnswer.trim()
              ? "bg-[#c2572b] hover:bg-[#d66130] text-white shadow-md cursor-pointer active:scale-95"
              : "bg-zinc-800/70 text-zinc-500 cursor-not-allowed opacity-50"
          }`}
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
        </button>
      </form>
    </motion.div>
  );
};
