import React, { useState } from "react";
import { X, Trash2, Sun, Globe, Download, FolderArchive } from "lucide-react";
import { ChatSession, ZenThemeConfig } from "../types";
import { downloadProjectZip } from "../utils/downloadZip";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ZenThemeConfig;
  session: ChatSession;
  onUpdateSessionSettings: (settings: any) => void;
  onExportMarkdown: () => void;
  onExportJSON: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetAllData,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div 
        className="w-full max-w-sm bg-[#18181b] border border-zinc-800 rounded-2xl p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-prompt text-lg font-semibold text-white">
            การตั้งค่า
          </h2>
          <button
            onClick={onClose}
            title="ปิด"
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Appearance Row */}
          <div className="flex items-center justify-between">
            <span className="font-thai text-[14px] text-zinc-300 flex items-center gap-3">
              <Sun className="w-5 h-5 text-zinc-400" />
              ธีมการแสดงผล
            </span>
            <div className="flex bg-[#09090b] rounded-lg p-1 border border-zinc-800">
              <button className="font-inter px-3.5 py-1.5 text-xs font-medium text-white bg-[#582be8] rounded-md shadow-xs">
                มืด (Dark)
              </button>
              <button className="font-inter px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
                สว่าง
              </button>
            </div>
          </div>

          {/* Language Row */}
          <div className="flex items-center justify-between">
            <span className="font-thai text-[14px] text-zinc-300 flex items-center gap-3">
              <Globe className="w-5 h-5 text-zinc-400" />
              ภาษา (Language)
            </span>
            <div className="bg-[#09090b] px-3.5 py-1.5 rounded-lg border border-zinc-800 text-xs font-inter text-zinc-200 flex items-center gap-2 cursor-pointer hover:border-zinc-700 transition-colors">
              <span>ไทย (Thai)</span>
              <span className="text-zinc-500 text-[10px]">▼</span>
            </div>
          </div>

          {/* Download Source Code ZIP */}
          <div className="p-3.5 bg-[#09090b] border border-emerald-500/20 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-thai text-xs font-semibold text-emerald-400 flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-emerald-400" />
                Source Code โปรเจกต์ (.ZIP)
              </span>
              <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800 px-2 py-0.5 rounded-full">
                ~100 KB
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-thai leading-relaxed">
              ไฟล์โปรเจกต์เว็บทั้งหมด (Frontend, Server, Configs) พร้อมรันในเครื่องหรือ Deploy ต่อได้ทันที
            </p>
            <button
              onClick={() => downloadProjectZip()}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer text-xs shadow-md shadow-emerald-950"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลดไฟล์ ZIP ตอนนี้ (~100 KB)</span>
            </button>
          </div>

          {/* Delete All Chats Button */}
          <div className="pt-2">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="font-thai w-full py-3 bg-[#121215] hover:bg-[#1c1c20] text-zinc-300 hover:text-white border border-zinc-800 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
              >
                <Trash2 className="w-4 h-4 text-zinc-400" />
                ล้างประวัติการแชททั้งหมด
              </button>
            ) : (
              <button
                onClick={() => {
                  onResetAllData();
                  setConfirmDelete(false);
                  onClose();
                }}
                className="font-thai w-full py-3 bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-500/50 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-sm font-medium shadow-md"
              >
                ยืนยัน — ลบข้อมูลทั้งหมด
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
