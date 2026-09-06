import React, { useState } from "react";
import { 
  X, 
  Settings, 
  Pin, 
  Trash2, 
  Compass, 
  Terminal, 
  ShieldAlert, 
  Layers, 
  Download, 
  Upload, 
  ChevronDown 
} from "lucide-react";
import { ChatSession, SystemPersona, ZenThemeConfig, ZenThemeId } from "../types";
import { SYSTEM_PERSONAS } from "../data/presets";
import { zenAudio } from "../utils/zenAudio";
import { ZeroworkLogo } from "./ZeroworkLogo";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onTogglePinSession: (id: string) => void;
  currentTheme: ZenThemeConfig;
  onSelectTheme: (themeId: ZenThemeId) => void;
  selectedPersona: SystemPersona;
  onSelectPersona: (persona: SystemPersona) => void;
  onOpenSettings: () => void;
  onExportAll: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onTogglePinSession,
  selectedPersona,
  onSelectPersona,
  onOpenSettings,
  onExportAll,
  onImport,
}) => {
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const ONE_WEEK = 7 * ONE_DAY;

  const pinnedSessions = sessions.filter((s) => s.pinned || s.isPinned);
  const unpinnedSessions = sessions.filter((s) => !s.pinned && !s.isPinned);

  const todaySessions = unpinnedSessions.filter((s) => now - s.updatedAt < ONE_DAY);
  const weekSessions = unpinnedSessions.filter(
    (s) => now - s.updatedAt >= ONE_DAY && now - s.updatedAt < ONE_WEEK
  );
  const previousSessions = unpinnedSessions.filter((s) => now - s.updatedAt >= ONE_WEEK);

  const getPersonaIcon = (iconName: string) => {
    switch (iconName) {
      case "Compass": return <Compass className="w-3.5 h-3.5" />;
      case "Terminal": return <Terminal className="w-3.5 h-3.5" />;
      case "ShieldAlert": return <ShieldAlert className="w-3.5 h-3.5" />;
      case "Layers": return <Layers className="w-3.5 h-3.5" />;
      default: return <Compass className="w-3.5 h-3.5" />;
    }
  };

  const renderSessionGroup = (title: string, groupSessions: ChatSession[]) => {
    if (groupSessions.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <div className="font-inter px-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          {title}
        </div>
        <div className="space-y-1">
          {groupSessions.map((s) => {
            const isActive = s.id === activeSessionId;
            const isPinned = s.pinned || s.isPinned;
            return (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSession(s.id);
                  zenAudio.playSoftClick();
                  if (window.innerWidth < 1024) onClose();
                }}
                className={`group px-3.5 py-2.5 text-[13.5px] flex items-center justify-between transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#18181b] border border-zinc-800 text-white font-normal rounded-xl shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200 rounded-xl hover:bg-zinc-900/60"
                }`}
              >
                <div className="flex items-center min-w-0 pr-2 gap-2 flex-1">
                  {isPinned && <Pin className="w-3 h-3 text-purple-400 shrink-0 fill-purple-400/30" />}
                  <span className="font-thai truncate">{s.title || "แชทใหม่"}</span>
                </div>

                {/* Pin & Delete Action Group */}
                <div className="flex items-center gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePinSession(s.id);
                      zenAudio.playSoftClick();
                    }}
                    title={isPinned ? "เลิกปักหมุด" : "ปักหมุดการสนทนา"}
                    className="p-1 text-zinc-400 hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-purple-400 text-purple-400" : ""}`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.id);
                      zenAudio.playSoftClick();
                    }}
                    title="ลบการสนทนา"
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs lg:hidden transition-opacity duration-300"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 sm:w-80 max-w-[85vw] bg-[#0c0c0e] border-r border-zinc-800/80 flex flex-col transition-all duration-300 ease-in-out shrink-0 select-none shadow-[20px_0_50px_rgba(0,0,0,0.9)] lg:shadow-none overflow-hidden rounded-r-2xl lg:rounded-r-2xl ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Top Header: ZEROWORK Logo + Close Button */}
        <div className="h-18 px-5 pt-safe flex items-center justify-between border-b border-zinc-900/50">
          <div 
            onClick={() => {
              onNewSession();
              if (window.innerWidth < 1024) onClose();
            }} 
            className="flex items-center cursor-pointer hover:opacity-85 transition-opacity py-1 flex-1 min-w-0 pr-2"
            title="ZEROWORK"
          >
            <ZeroworkLogo height={38} className="max-w-[190px]" />
          </div>

          {/* Close Sidebar button */}
          <button
            onClick={onClose}
            title="ปิดแถบข้าง"
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* New Chat Primary Button */}
        <div className="px-5 pt-4 pb-2">
          <button
            onClick={() => {
              zenAudio.playSoftClick();
              onNewSession();
              if (window.innerWidth < 1024) onClose();
            }}
            className="font-inter w-full h-11 bg-white hover:bg-zinc-200 active:scale-[0.98] text-black text-[14px] font-medium rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs"
          >
            <span>แชทใหม่</span>
          </button>
        </div>

        {/* Persona Switcher Capsule */}
        <div className="px-5 py-2 relative">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 px-1 font-inter">
            บทบาทผู้ช่วย (Persona)
          </div>
          <button
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            className="w-full px-3 py-2 bg-[#161618] hover:bg-zinc-800/80 border border-zinc-800 rounded-xl flex items-center justify-between text-xs text-zinc-200 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-purple-400">{getPersonaIcon(selectedPersona.icon)}</span>
              <span className="font-thai truncate font-medium">{selectedPersona.nameTh || selectedPersona.name}</span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${showPersonaMenu ? "rotate-180" : ""}`} />
          </button>

          {showPersonaMenu && (
            <div className="absolute left-5 right-5 mt-1.5 bg-[#18181b] border border-zinc-800 rounded-xl p-1.5 shadow-xl z-50 space-y-1">
              {SYSTEM_PERSONAS.map((p) => {
                const isSelected = selectedPersona.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectPersona(p);
                      setShowPersonaMenu(false);
                      zenAudio.playSoftClick();
                    }}
                    className={`w-full px-2.5 py-2 rounded-lg text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-purple-600 text-white font-medium shadow-xs"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <span>{getPersonaIcon(p.icon)}</span>
                    <div className="truncate">
                      <div className="font-thai truncate">{p.nameTh || p.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat Sessions List Grouped by Pin & Date */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-5">
          {sessions.length === 0 ? (
            <div className="font-thai px-1 text-xs text-zinc-600 py-4 text-center">
              ยังไม่มีการสนทนา
            </div>
          ) : (
            <>
              {pinnedSessions.length > 0 && renderSessionGroup("ที่ปักหมุดไว้", pinnedSessions)}
              {renderSessionGroup("วันนี้", todaySessions)}
              {renderSessionGroup("สัปดาห์นี้", weekSessions)}
              {renderSessionGroup("ก่อนหน้านี้", previousSessions)}
            </>
          )}
        </div>

        {/* Sidebar Footer: Quick Backup + Settings */}
        <div className="px-5 py-3 mt-auto border-t border-zinc-900 space-y-2 bg-[#0a0a0c]">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1 pt-1">
            <button
              onClick={() => {
                onExportAll();
                zenAudio.playZenChime();
              }}
              title="ส่งออกสำรองข้อมูลทั้งหมด"
              className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer py-1"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>สำรองข้อมูล</span>
            </button>
            <label
              title="นำเข้าไฟล์สำรองข้อมูล"
              className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer py-1"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>นำเข้า</span>
              <input type="file" accept=".json" onChange={onImport} className="hidden" />
            </label>
          </div>

          <button
            onClick={() => {
              zenAudio.playSoftClick();
              onOpenSettings();
            }}
            className="font-inter flex items-center gap-2.5 px-3 py-2 bg-[#161618] hover:bg-zinc-800 border border-zinc-800/80 rounded-xl text-[13px] text-zinc-300 hover:text-white transition-all cursor-pointer w-full text-left"
          >
            <Settings className="w-4 h-4 text-purple-400" />
            <span className="font-thai flex-1 font-medium">การตั้งค่าระบบ</span>
          </button>
        </div>
      </aside>
    </>
  );
};
