import React, { useState } from "react";
import { X, Plus, Trash2, Brain, Database, FileText, Check } from "lucide-react";
import { KnowledgeItem } from "../types";
import { zenAudio } from "../utils/zenAudio";

interface KnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: KnowledgeItem[];
  onAddItem: (item: Omit<KnowledgeItem, "id" | "createdAt">) => void;
  onDeleteItem: (id: string) => void;
}

export const KnowledgeModal: React.FC<KnowledgeModalProps> = ({
  isOpen,
  onClose,
  items,
  onAddItem,
  onDeleteItem,
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<KnowledgeItem["category"]>("context");
  const [added, setAdded] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    onAddItem({
      title: title.trim(),
      content: content.trim(),
      category,
    });

    setTitle("");
    setContent("");
    setAdded(true);
    zenAudio.playCopyChime();
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <Brain className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-zinc-100 font-sans">
                Project Memory & RAG Knowledge Base
              </h3>
              <p className="text-xs text-zinc-400 font-thai">
                เพิ่มกฎ เอกสาร หรือบริบทของโปรเจกต์ เพื่อให้ระบบ AI จดจำและอ้างอิงอัตโนมัติ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Add New Memory Card */}
          <form onSubmit={handleSubmit} className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl space-y-3">
            <h4 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-400" />
              <span>เพิ่มบันทึกความรู้ใหม่ (Add Knowledge Item)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="ชื่อหัวข้อ (Title)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="sm:col-span-2 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-purple-500/60"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none"
              >
                <option value="context">บริบทโปรเจกต์ (Context)</option>
                <option value="documentation">เอกสาร/คู่มือ (Docs)</option>
                <option value="snippet">โค้ดอ้างอิง (Code Snippet)</option>
                <option value="preference">ข้อกำหนดเฉพาะ (Preference)</option>
              </select>
            </div>

            <textarea
              placeholder="เนื้อหา รายละเอียด หรือโค้ดตัวอย่างที่ต้องการให้ AI จดจำ..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-purple-500/60 font-mono resize-none"
            />

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={!title.trim() || !content.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium rounded-xl transition-all shadow-md shadow-purple-600/30 active:scale-95 cursor-pointer"
              >
                {added ? <Check className="w-4 h-4 text-emerald-300" /> : <Plus className="w-4 h-4" />}
                <span>{added ? "บันทึกเรียบร้อย!" : "เพิ่มเข้า RAG Memory"}</span>
              </button>
            </div>
          </form>

          {/* Stored Knowledge List */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span>รายการความรู้ที่บันทึกแล้ว ({items.length})</span>
            </h4>

            {items.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/30 border border-zinc-800/50 rounded-2xl text-zinc-500 text-xs font-thai">
                ยังไม่มีรายการความรู้ที่บันทึก สามารถเพิ่มข้อมูลที่เกี่ยวข้องเพื่อให้ AI อ้างอิงบริบทโปรเจกต์ได้เลยครับ
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {items.map((item) => (
                  <div key={item.id} className="p-3.5 bg-zinc-900/70 border border-zinc-800 rounded-xl flex items-start justify-between gap-3 group">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="text-xs font-semibold text-zinc-200 font-sans truncate">{item.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 font-mono border border-purple-500/20">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono line-clamp-2 leading-relaxed pl-5 whitespace-pre-wrap">
                        {item.content}
                      </p>
                    </div>

                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors opacity-60 group-hover:opacity-100"
                      title="ลบรายการ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
