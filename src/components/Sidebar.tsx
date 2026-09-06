import React from "react";
import { 
  X, 
  Settings, 
} from "lucide-react";
import { ChatSession, SystemPersona, ZenThemeConfig, ZenThemeId } from "../types";
import { zenAudio } from "../utils/zenAudio";
import { JomcodeLogo } from "./JomcodeLogo";

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
  onOpenSettings,
}) => {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const ONE_WEEK = 7 * ONE_DAY;

  const todaySessions = sessions.filter((s) => now - s.updatedAt < ONE_DAY);
  const weekSessions = sessions.filter(
    (s) => now - s.updatedAt >= ONE_DAY && now - s.updatedAt < ONE_WEEK
  );
  const previousSessions = sessions.filter((s) => now - s.updatedAt >= ONE_WEEK);

  const renderSessionGroup = (title: string, groupSessions: ChatSession[]) => {
    if (groupSessions.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <div className="font-inter px-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
          {title}
        </div>
        <div className="space-y-1">
          {groupSessions.map((s) => {
            const isActive = s.id === activeSessionId;
            return (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSession(s.id);
                  zenAudio.playSoftClick();
                  if (window.innerWidth < 1024) onClose();
                }}
                className={`group px-4 py-3 text-[14px] flex items-center justify-between transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#161618] border border-zinc-800/80 text-white font-normal rounded-xl shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200 rounded-xl hover:bg-zinc-900/50"
                }`}
              >
                <div className="flex items-center min-w-0 pr-2">
                  <span className="font-thai truncate">{s.title || "แชทใหม่"}</span>
                </div>

                {/* Delete Action on Right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                  title="ลบการสนทนา"
                  className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0 opacity-40 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
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
        {/* Top Header: Jomcode Pixel Logo + Close Button */}
        <div className="h-16 flex items-center justify-between px-5 pt-safe">
          <div 
            onClick={() => {
              onNewSession();
              if (window.innerWidth < 1024) onClose();
            }} 
            className="flex items-center cursor-pointer hover:opacity-90 transition-opacity py-1"
            title="JOMCODE"
          >
            <JomcodeLogo height={28} />
          </div>

          {/* Close Sidebar button */}
          <button
            onClick={onClose}
            title="ปิดแถบข้าง"
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Primary Button (White Rounded Capsule Button) */}
        <div className="px-5 pt-1 pb-4">
          <button
            onClick={() => {
              zenAudio.playSoftClick();
              onNewSession();
              if (window.innerWidth < 1024) onClose();
            }}
            className="font-inter w-full h-12 bg-white hover:bg-zinc-200 active:scale-[0.98] text-black text-[15px] font-medium rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm"
          >
            <span>แชทใหม่</span>
          </button>
        </div>

        {/* Chat Sessions List Grouped by Date */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-6">
          {sessions.length === 0 || (todaySessions.length === 0 && weekSessions.length === 0 && previousSessions.length === 0) ? (
            <div className="font-thai px-1 text-xs text-zinc-600">
              ยังไม่มีการสนทนา
            </div>
          ) : (
            <>
              {renderSessionGroup("วันนี้", todaySessions)}
              {renderSessionGroup("สัปดาห์นี้", weekSessions)}
              {renderSessionGroup("ก่อนหน้านี้", previousSessions)}
            </>
          )}
        </div>

        {/* Sidebar Footer: Settings */}
        <div className="px-5 py-4 mt-auto border-t border-zinc-900 space-y-1">
          <button
            onClick={() => {
              zenAudio.playSoftClick();
              onOpenSettings();
            }}
            className="font-inter flex items-center gap-3 px-1 py-2 text-[14px] text-zinc-400 hover:text-white transition-all cursor-pointer w-full text-left"
          >
            <Settings className="w-4.5 h-4.5 text-zinc-400" />
            <span className="font-thai">การตั้งค่า</span>
          </button>
        </div>
      </aside>
    </>
  );
};
