import React, { useState } from "react";
import { X, Trash2, Sun, Moon, Globe } from "lucide-react";
import { ChatSession, ZenThemeConfig, ZenThemeId } from "../types";
import { zenAudio } from "../utils/zenAudio";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ZenThemeConfig;
  onSelectTheme?: (themeId: ZenThemeId) => void;
  session?: ChatSession;
  onUpdateSessionSettings?: (settings: Partial<ChatSession>) => void;
  onExportMarkdown?: () => void;
  onExportJSON?: () => void;
  onImportJSON?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetAllData,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [language, setLanguage] = useState("English");
  const [appearance, setAppearance] = useState<"Dark" | "Light">("Dark");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div 
        className="w-full max-w-[400px] bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <h2 className="text-base font-medium text-white">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-0 flex flex-col text-sm">
          {/* Appearance Selection */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              {appearance === "Dark" ? (
                <Moon className="w-5 h-5 text-zinc-400" />
              ) : (
                <Sun className="w-5 h-5 text-zinc-400" />
              )}
              <span className="text-zinc-200">Appearance</span>
            </div>
            <div className="flex bg-[#18181b] rounded-lg p-1 border border-zinc-800">
              <button
                onClick={() => {
                  setAppearance("Dark");
                  zenAudio.playSoftClick();
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  appearance === "Dark" ? "bg-[#582be8] text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => {
                  setAppearance("Light");
                  zenAudio.playSoftClick();
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  appearance === "Light" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Light
              </button>
            </div>
          </div>

          {/* Language Selection */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-[#141416]">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-zinc-400" />
              <span className="text-zinc-200">Language</span>
            </div>
            <div>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  zenAudio.playSoftClick();
                }}
                className="bg-transparent border border-zinc-700 text-zinc-300 text-sm rounded-lg outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 p-1.5 cursor-pointer appearance-none"
                style={{ WebkitAppearance: 'none', paddingRight: '24px', background: 'url("data:image/svg+xml;utf8,<svg fill=%27%2371717a%27 height=%2724%27 viewBox=%270 0 24 24%27 width=%2724%27 xmlns=%27http://www.w3.org/2000/svg%27><path d=%27M7 10l5 5 5-5z%27/></svg>") no-repeat right 4px center' }}
              >
                <option value="English" className="bg-[#18181b]">English</option>
                <option value="Thai" className="bg-[#18181b]">Thai</option>
                <option value="Spanish" className="bg-[#18181b]">Spanish</option>
                <option value="French" className="bg-[#18181b]">French</option>
                <option value="German" className="bg-[#18181b]">German</option>
                <option value="Japanese" className="bg-[#18181b]">Japanese</option>
                <option value="Korean" className="bg-[#18181b]">Korean</option>
              </select>
            </div>
          </div>

          {/* Delete All History */}
          <div className="px-6 py-5">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 bg-transparent hover:bg-[#18181b] text-zinc-300 border border-zinc-800 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
              >
                <Trash2 className="w-4 h-4 text-zinc-400" />
                Clear all chats
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onResetAllData();
                    setConfirmDelete(false);
                    onClose();
                  }}
                  className="flex-1 py-2.5 bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-500/50 rounded-xl flex items-center justify-center transition-all cursor-pointer text-sm font-medium"
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2.5 bg-[#18181b] text-zinc-300 border border-zinc-800 rounded-xl hover:bg-zinc-800 cursor-pointer text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
