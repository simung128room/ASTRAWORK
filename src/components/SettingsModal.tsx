import React, { useState } from "react";
import { 
  X, 
  Trash2, 
  Palette, 
  Globe, 
  Volume2, 
  VolumeX, 
  Download, 
  Upload, 
  FileText, 
  Sliders, 
  Check, 
  Sparkles 
} from "lucide-react";
import { ChatSession, ZenThemeConfig, ZenThemeId } from "../types";
import { ZEN_THEMES } from "../data/presets";
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
  theme,
  onSelectTheme,
  session,
  onUpdateSessionSettings,
  onExportMarkdown,
  onExportJSON,
  onImportJSON,
  onResetAllData,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => zenAudio.isEnabled());
  const [language, setLanguage] = useState<"th" | "en">("th");
  const [activeTab, setActiveTab] = useState<"general" | "theme" | "session" | "backup">("general");

  const [customPrompt, setCustomPrompt] = useState(session?.customSystemPrompt || "");
  const [temperature, setTemperature] = useState(session?.temperature !== undefined ? session.temperature : 0.7);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    zenAudio.setSoundEnabled(next);
    if (next) zenAudio.playZenChime();
  };

  const handleSaveSessionSettings = () => {
    if (onUpdateSessionSettings) {
      onUpdateSessionSettings({
        customSystemPrompt: customPrompt.trim() || undefined,
        temperature: temperature,
      });
      zenAudio.playSoftClick();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div 
        className="w-full max-w-lg bg-[#141416] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-[#0e0e10]">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-purple-400" />
            <h2 className="font-prompt text-lg font-semibold text-white">
              การตั้งค่า (Settings)
            </h2>
          </div>
          <button
            onClick={onClose}
            title="ปิด"
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-[#111113] px-6 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab("general")}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "general"
                ? "border-purple-500 text-white font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            ทั่วไป (General)
          </button>
          <button
            onClick={() => setActiveTab("theme")}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "theme"
                ? "border-purple-500 text-white font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            ธีม (Themes)
          </button>
          <button
            onClick={() => setActiveTab("session")}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "session"
                ? "border-purple-500 text-white font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            ปรับแต่ง AI (Prompt & Temp)
          </button>
          <button
            onClick={() => setActiveTab("backup")}
            className={`py-3 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "backup"
                ? "border-purple-500 text-white font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            สำรองข้อมูล (Backup)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* TAB 1: GENERAL */}
          {activeTab === "general" && (
            <div className="space-y-5">
              {/* Sound Effects Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-[#18181b] border border-zinc-800 rounded-xl">
                <div className="flex items-center gap-3">
                  {soundEnabled ? (
                    <Volume2 className="w-5 h-5 text-purple-400" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-zinc-500" />
                  )}
                  <div>
                    <div className="font-thai text-zinc-100 font-medium">เสียงเอฟเฟกต์ (Zen Sound)</div>
                    <div className="text-xs text-zinc-400">เสียงกระดิ่งเซน 528Hz เมื่อสร้างข้อความเสร็จและคลิกปุ่ม</div>
                  </div>
                </div>
                <button
                  onClick={handleToggleSound}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    soundEnabled
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {soundEnabled ? "เปิดใช้งาน" : "ปิดเสียง"}
                </button>
              </div>

              {/* Language Selection */}
              <div className="flex items-center justify-between p-3.5 bg-[#18181b] border border-zinc-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-zinc-400" />
                  <div>
                    <div className="font-thai text-zinc-100 font-medium">ภาษาหลักในการตอบ (Language)</div>
                    <div className="text-xs text-zinc-400">เลือกภาษาเริ่มต้นของระบบ</div>
                  </div>
                </div>
                <div className="flex bg-[#09090b] rounded-lg p-1 border border-zinc-800">
                  <button
                    onClick={() => {
                      setLanguage("th");
                      zenAudio.playSoftClick();
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      language === "th" ? "bg-[#582be8] text-white" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    ไทย
                  </button>
                  <button
                    onClick={() => {
                      setLanguage("en");
                      zenAudio.playSoftClick();
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      language === "en" ? "bg-[#582be8] text-white" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Delete All History */}
              <div className="pt-2 border-t border-zinc-800/80">
                <div className="text-xs text-zinc-500 mb-2 font-thai">จัดการข้อมูลและประวัติ</div>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="font-thai w-full py-3 bg-[#18181b] hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
                  >
                    <Trash2 className="w-4 h-4 text-zinc-400" />
                    ล้างประวัติการแชททั้งหมด
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        onResetAllData();
                        setConfirmDelete(false);
                        onClose();
                      }}
                      className="font-thai w-full py-3 bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-500/50 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-sm font-medium shadow-md"
                    >
                      ยืนยัน — ลบข้อมูลการสนทนาทั้งหมดอย่างถาวร
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: THEMES */}
          {activeTab === "theme" && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-400 font-thai">
                เลือกรูปแบบธีมสำหรับสภาพแวดล้อมของคุณ (Zen Aesthetics Palette)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.values(ZEN_THEMES).map((t) => {
                  const isSelected = theme.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        if (onSelectTheme) onSelectTheme(t.id);
                        zenAudio.playSoftClick();
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-purple-950/30 border-purple-500 shadow-md ring-1 ring-purple-500"
                          : "bg-[#18181b] border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-medium text-white text-sm flex items-center gap-2">
                          <Palette className="w-4 h-4 text-purple-400" />
                          {t.nameTh || t.name}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-purple-400" />}
                      </div>
                      <div className="text-xs text-zinc-400 line-clamp-2">{t.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: SESSION SETTINGS */}
          {activeTab === "session" && (
            <div className="space-y-5">
              <div>
                <label className="block text-zinc-200 font-medium mb-1.5 font-thai">
                  คำสั่งระบบเพิ่มเติม (Custom System Prompt)
                </label>
                <div className="text-xs text-zinc-400 mb-2">
                  กำหนดบริบทเฉพาะสำหรับแชทปัจจุบัน เช่น "ตอบเฉพาะโค้ด TypeScript สไตล์ Functional"
                </div>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="เช่น: เน้นเขียนโค้ด Next.js App Router, ตอบสั้นกระชับ, อธิบายเป็นภาษาไทย..."
                  rows={4}
                  className="w-full bg-[#18181b] border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 font-thai resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-zinc-200 font-medium font-thai">
                    ระดับความคิดสร้างสรรค์ (Temperature: {temperature})
                  </label>
                  <span className="text-xs text-purple-400 font-mono">
                    {temperature <= 0.3 ? "แม่นยำสูง (Deterministic)" : temperature <= 0.7 ? "สมดุล (Balanced)" : "สร้างสรรค์ (Creative)"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 bg-zinc-800 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-zinc-500 mt-1">
                  <span>0.0 (แม่นยำสูงสุด)</span>
                  <span>0.5 (ค่ามาตรฐาน)</span>
                  <span>1.0 (อิสระ)</span>
                </div>
              </div>

              <button
                onClick={handleSaveSessionSettings}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                บันทึกการตั้งค่าแชทนี้
              </button>
            </div>
          )}

          {/* TAB 4: BACKUP & EXPORT */}
          {activeTab === "backup" && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-400 font-thai">
                ส่งออกหรือนำเข้าประวัติการสนทนา เพื่อความปลอดภัยและการใช้งานออฟไลน์
              </div>

              {/* Export Markdown */}
              {onExportMarkdown && (
                <button
                  onClick={() => {
                    onExportMarkdown();
                    zenAudio.playZenChime();
                  }}
                  className="w-full p-3.5 bg-[#18181b] hover:bg-zinc-800 border border-zinc-800 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="font-medium text-zinc-200">ส่งออกแชทปัจจุบันเป็น Markdown (.md)</div>
                      <div className="text-xs text-zinc-400">บันทึกข้อความและโค้ดเป็นไฟล์เอกสาร</div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                </button>
              )}

              {/* Export JSON */}
              {onExportJSON && (
                <button
                  onClick={() => {
                    onExportJSON();
                    zenAudio.playZenChime();
                  }}
                  className="w-full p-3.5 bg-[#18181b] hover:bg-zinc-800 border border-zinc-800 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="font-medium text-zinc-200">สำรองข้อมูลทั้งหมดเป็น JSON (.json)</div>
                      <div className="text-xs text-zinc-400">สำรองทุกแชทและการตั้งค่าทั้งหมด</div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                </button>
              )}

              {/* Import JSON */}
              {onImportJSON && (
                <label className="w-full p-3.5 bg-[#18181b] hover:bg-zinc-800 border border-zinc-800 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <Upload className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="font-medium text-zinc-200">นำเข้าไฟล์สำรองข้อมูล (.json)</div>
                      <div className="text-xs text-zinc-400">กู้คืนประวัติการแชทจากไฟล์ที่บันทึกไว้</div>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      if (onImportJSON) onImportJSON(e);
                      zenAudio.playZenChime();
                    }}
                    className="hidden"
                  />
                  <Upload className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
