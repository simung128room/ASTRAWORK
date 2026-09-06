import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChatSession, Message, SystemPersona, ZenThemeId, FileAttachment } from "./types";
import { SYSTEM_PERSONAS, ZEN_THEMES } from "./data/presets";
import { Sidebar } from "./components/Sidebar";
import { ChatMessage, extractThinkingMainAndQuestion } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { ClaudeQuestionSheet } from "./components/ClaudeQuestionSheet";
import { SettingsModal } from "./components/SettingsModal";
import { zenAudio } from "./utils/zenAudio";
import { ArrowDown, Menu } from "lucide-react";
import { DynamicGreeting } from "./components/DynamicGreeting";

const STORAGE_KEY_SESSIONS = "opencode_zen_sessions_v2";
const STORAGE_KEY_THEME = "opencode_zen_theme_v2";
const STORAGE_KEY_ACTIVE_ID = "opencode_zen_active_id_v2";

const DEFAULT_SESSION: ChatSession = {
  id: "session-initial",
  title: "บทสนทนาใหม่",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
  personaId: "zen-coder",
  model: "Z one",
  temperature: 0.7,
  scratchpadCode: `// กระดานทดลองโค้ด - ทดสอบโค้ดของคุณที่นี่\nfunction add(a: number, b: number): number {\n  return a + b;\n}\n\nconsole.log(add(10, 25));`,
  scratchpadLang: "typescript",
};

export default function App() {
  // Theme State
  const [themeId, setThemeId] = useState<ZenThemeId>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY_THEME) as ZenThemeId;
      if (saved && ZEN_THEMES[saved]) return saved;
    }
    return "geometric-balance";
  });

  // Sessions State (Default to Z one Autonomous Intelligence)
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_SESSIONS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((s: ChatSession) => ({
              ...s,
              model: s.model?.includes("Z") || s.model?.includes("z") || s.model?.includes("JOM") ? "Z one" : (s.model || "Z one"),
            }));
          }
        }
      } catch (e) {
        console.error("Failed to parse saved sessions", e);
      }
    }
    return [DEFAULT_SESSION];
  });

  // Active Session Id
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
      if (savedId) return savedId;
    }
    return DEFAULT_SESSION.id;
  });

  // UI Panels State (Sidebar open by default on desktop)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [dismissedQuestionIds, setDismissedQuestionIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentTheme = ZEN_THEMES[themeId] || ZEN_THEMES["geometric-balance"];

  // Active session helper
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || DEFAULT_SESSION;
  const selectedPersona = SYSTEM_PERSONAS.find((p) => p.id === activeSession.personaId) || SYSTEM_PERSONAS[0];

  // Active question extracted from the latest assistant message (Claude style)
  const latestMessage = activeSession.messages[activeSession.messages.length - 1];
  const latestParsed =
    latestMessage?.role === "assistant" && !isStreaming
      ? extractThinkingMainAndQuestion(latestMessage.content)
      : null;
  const activeQuestion =
    latestMessage && !dismissedQuestionIds.has(latestMessage.id)
      ? latestParsed?.questionData
      : null;

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.error("Failed to save sessions", e);
    }
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_THEME, themeId);
  }, [themeId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeSessionId);
  }, [activeSessionId]);

  // Scroll to bottom on new messages
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [activeSessionId, activeSession?.messages?.length]);

  // Handle scroll detection for scroll-to-bottom button
  const handleScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isFarFromBottom);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+N for new chat
      if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        handleNewSession();
      }
      // Alt+S for Scratchpad
      if (e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        setIsScratchpadOpen((prev) => !prev);
      }
      // Alt+F for Focus Mode
      if (e.altKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sessions]);

  // Send message to Gemini / Model
  const handleSendMessage = async (
    text: string, 
    attachments?: FileAttachment[], 
    overrideBaseMessages?: Message[]
  ) => {
    const cleanText = text.trim();
    if (!cleanText && (!attachments || attachments.length === 0)) return;
    if (isStreaming) return;

    // Format message prompt including any file content
    let apiPrompt = cleanText;
    if (attachments && attachments.length > 0) {
      const attachmentsContext = attachments
        .map((a) => {
          if (a.isText && a.content) {
            return `[ไฟล์แนบ: ${a.name}]\n\`\`\`${a.extension || ""}\n${a.content}\n\`\`\``;
          }
          return `[ไฟล์แนบ: ${a.name} (${(a.size / 1024).toFixed(1)} KB, ประเภท: ${a.type})]`;
        })
        .join("\n\n");

      if (cleanText) {
        apiPrompt = `${cleanText}\n\n${attachmentsContext}`;
      } else {
        apiPrompt = `ช่วยวิเคราะห์และให้คำแนะนำเกี่ยวกับไฟล์ที่แนบมานี้อย่างละเอียด:\n\n${attachmentsContext}`;
      }
    }

    const displayContent = cleanText || (attachments && attachments.length > 0 ? `แนบไฟล์: ${attachments.map((a) => a.name).join(", ")}` : "");

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: displayContent,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      timestamp: Date.now(),
    };

    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      model: activeSession.model || "Z one",
      isStreaming: true,
    };

    const baseHistory = overrideBaseMessages ?? activeSession.messages;

    // Auto generate session title if first user message
    let updatedTitle = activeSession.title;
    if (baseHistory.length === 0 || activeSession.title === "New Chat" || activeSession.title === "บทสนทนาใหม่") {
      const titleSeed = cleanText || (attachments?.[0]?.name ?? "แชทใหม่");
      updatedTitle = titleSeed.slice(0, 32) + (titleSeed.length > 32 ? "..." : "");
    }

    const updatedMessages = [...baseHistory, userMessage, assistantPlaceholder];

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              title: updatedTitle,
              updatedAt: Date.now(),
              messages: updatedMessages,
            }
          : s
      )
    );

    setIsStreaming(true);
    zenAudio.playZenChime();

    // Prepare API history from clean base history
    const historyPayload = baseHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: apiPrompt,
          attachments: attachments,
          history: historyPayload,
          personaId: activeSession.personaId || "zen-coder",
          model: activeSession.model || "Z one",
          temperature: activeSession.temperature ?? 0.7,
          customSystemPrompt: activeSession.customSystemPrompt,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errMessage = `Server status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error) {
            errMessage = errData.error;
          }
        } catch {
          // ignore parse error
        }
        throw new Error(errMessage);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let isCompleted = false;
      let lastAudioTick = 0;

      // 144FPS Ultra-smooth High-Refresh RAF Text Buffer for zero-lag streaming
      let rafPending = false;

      const scheduleFlush = () => {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          const currentText = accumulatedText;
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSession.id
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: currentText, isStreaming: !isCompleted }
                        : m
                    ),
                  }
                : s
            )
          );
        });
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                accumulatedText += data.text;
                
                const now = Date.now();
                if (now - lastAudioTick > 120) {
                  zenAudio.playSoftClick();
                  lastAudioTick = now;
                }

                scheduleFlush();
              }
              if (data.error) {
                accumulatedText += `\n\n*Error: ${data.error}*`;
                scheduleFlush();
              }
            } catch {
              // ignore parse errors in stream chunks
            }
          }
        }
      }

      isCompleted = true;

      // Finalize message
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: accumulatedText || "No response received.", isStreaming: false }
                    : m
                ),
              }
            : s
        )
      );

    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Stream stopped by user");
      } else {
        console.error("Chat error:", err);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          content: (m.content || "") + `\n\n⚠️ **Connection issue**: ${err.message || "Failed to reach AI service"}`,
                          isStreaming: false,
                        }
                      : m
                  ),
                }
              : s
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Stop streaming
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  // Regenerate message (replaces the assistant message cleanly without duplication)
  const handleRegenerate = (messageId: string) => {
    const msgIndex = activeSession.messages.findIndex((m) => m.id === messageId);
    if (msgIndex <= 0) return;

    const previousUserMsg = activeSession.messages[msgIndex - 1];
    if (previousUserMsg && previousUserMsg.role === "user") {
      const truncatedMessages = activeSession.messages.slice(0, msgIndex - 1);
      handleSendMessage(previousUserMsg.content, previousUserMsg.attachments, truncatedMessages);
    }
  };

  // Edit user message and resend (truncates history from that point and resends)
  const handleEditAndResend = (newContent: string, messageId?: string) => {
    if (messageId) {
      const msgIndex = activeSession.messages.findIndex((m) => m.id === messageId);
      const truncated = msgIndex >= 0 ? activeSession.messages.slice(0, msgIndex) : activeSession.messages;
      handleSendMessage(newContent, undefined, truncated);
    } else {
      handleSendMessage(newContent);
    }
  };

  // Create new session
  const handleNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: "บทสนทนาใหม่",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      personaId: selectedPersona.id,
      model: "Z one",
      temperature: selectedPersona.suggestedTemperature,
      scratchpadCode: activeSession.scratchpadCode || "",
      scratchpadLang: activeSession.scratchpadLang || "typescript",
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    zenAudio.playCopyChime();
  };

  // Delete session
  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) {
      handleNewSession();
      return;
    }
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (activeSessionId === id) {
      setActiveSessionId(remaining[0].id);
    }
  };

  // Toggle Pin
  const handleTogglePinSession = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s))
    );
  };

  // Scratchpad handler
  const handleSendToScratchpad = (code: string, lang: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? { ...s, scratchpadCode: code, scratchpadLang: lang }
          : s
      )
    );
    setIsScratchpadOpen(true);
  };

  // Export session to Markdown
  const handleExportMarkdown = () => {
    const lines = [
      `# ${activeSession.title}`,
      `*Exported on ${new Date().toLocaleString()}*`,
      "",
      "---",
      "",
    ];

    activeSession.messages.forEach((m) => {
      lines.push(`### ${m.role === "user" ? "👤 User" : "🤖 OpenCode Zen"}`);
      lines.push(m.content);
      lines.push("");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSession.title.toLowerCase().replace(/[^a-z0-9]/gi, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    zenAudio.playCopyChime();
  };

  // Export all sessions to JSON
  const handleExportJSON = () => {
    const data = {
      sessions,
      themeId,
      version: 2,
      exportedAt: Date.now(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `opencode_zen_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    zenAudio.playCopyChime();
  };

  // Import sessions from JSON with strict schema validation
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        if (!raw || typeof raw !== "string") {
          showToast("ไฟล์ว่างเปล่าหรืออ่านข้อมูลไม่สำเร็จ", "error");
          return;
        }

        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
          // Validate and sanitize each session structure
          const validatedSessions: ChatSession[] = parsed.sessions
            .filter((s: any) => s && typeof s.id === "string")
            .map((s: any) => ({
              id: String(s.id).slice(0, 100),
              title: typeof s.title === "string" ? s.title.slice(0, 150) : "บทสนทนา",
              messages: Array.isArray(s.messages)
                ? s.messages
                    .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
                    .map((m: any) => ({
                      id: String(m.id || `msg-${Date.now()}`),
                      role: m.role,
                      content: typeof m.content === "string" ? m.content : "",
                      timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
                      model: typeof m.model === "string" ? m.model : undefined,
                      attachments: Array.isArray(m.attachments) ? m.attachments : undefined,
                    }))
                : [],
              updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : Date.now(),
              model: typeof s.model === "string" ? s.model : "Z one",
              isPinned: Boolean(s.isPinned),
              personaId: typeof s.personaId === "string" ? s.personaId : "zen-master",
              temperature: typeof s.temperature === "number" ? s.temperature : 0.7,
              customSystemPrompt: typeof s.customSystemPrompt === "string" ? s.customSystemPrompt : undefined,
              scratchpadCode: typeof s.scratchpadCode === "string" ? s.scratchpadCode : undefined,
              scratchpadLang: typeof s.scratchpadLang === "string" ? s.scratchpadLang : undefined,
            }));

          if (validatedSessions.length > 0) {
            setSessions(validatedSessions);
            setActiveSessionId(validatedSessions[0].id);
            if (parsed.themeId && ZEN_THEMES[parsed.themeId as ZenThemeId]) {
              setThemeId(parsed.themeId as ZenThemeId);
            }
            showToast(`นำเข้าประวัติสนทนา ${validatedSessions.length} รายการสำเร็จ!`, "success");
            zenAudio.playCopyChime();
          } else {
            showToast("ไม่พบข้อมูลแชตที่ถูกต้องในไฟล์ JSON", "error");
          }
        } else {
          showToast("รูปแบบไฟล์ JSON ไม่ถูกต้อง", "error");
        }
      } catch (err) {
        showToast("เกิดข้อผิดพลาดในการแปลงไฟล์ JSON", "error");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = "";
  };

  const handleResetAllData = () => {
    localStorage.removeItem(STORAGE_KEY_SESSIONS);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
    setSessions([DEFAULT_SESSION]);
    setActiveSessionId(DEFAULT_SESSION.id);
  };

  const scratchpadLineCount = (activeSession.scratchpadCode || "").split("\n").length;
  const isChatEmpty = !activeSession.messages || activeSession.messages.length === 0;

  return (
    <div className="flex h-[100dvh] w-full bg-[#000000] text-zinc-100 font-sans overflow-hidden antialiased relative selection:bg-purple-500/30">
      {/* Left Sidebar */}
      {isSidebarOpen && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onTogglePinSession={handleTogglePinSession}
          currentTheme={currentTheme}
          onSelectTheme={setThemeId}
          selectedPersona={selectedPersona}
          onSelectPersona={(persona) => {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === activeSession.id
                  ? { ...s, personaId: persona.id, temperature: persona.suggestedTemperature }
                  : s
              )
            );
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExportAll={handleExportJSON}
          onImport={handleImportJSON}
        />
      )}

      {/* Main Column */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] relative overflow-hidden bg-[#000000] z-10">
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-4 duration-200 bg-zinc-900/95 border border-zinc-700 text-zinc-100">
            <span
              className={`w-2 h-2 rounded-full ${
                toastMessage.type === "success" ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Top Header Controls: Sidebar */}
        <div className="absolute top-3.5 left-3.5 z-30 flex items-center pointer-events-none">
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            title="เปิด/ปิด เมนู"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer active:scale-95 pointer-events-auto bg-zinc-950/80 border border-zinc-800"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Content View: Hero / Active Chat */}
        {isChatEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 relative">
            <div className="w-full max-w-xl text-center space-y-6 -mt-10 animate-in fade-in duration-300">
              {/* Dynamic Alternating Greeting Banner */}
              <div className="mb-2">
                <DynamicGreeting />
              </div>

              {/* Centered Ox Alpha Capsule Input */}
              <ChatInput
                onSendMessage={handleSendMessage}
                onStopStreaming={handleStopStreaming}
                isStreaming={isStreaming}
                theme={currentTheme}
                isFocusMode={isFocusMode}
                onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
                selectedPersonaName={selectedPersona.name}
                isHeroMode={true}
                currentModelId={activeSession.model || "JOM-AGENT"}
                onSelectModel={(model) => {
                  setSessions((prev) =>
                    prev.map((s) => (s.id === activeSession.id ? { ...s, model } : s))
                  );
                }}
              />
            </div>
          </div>
        ) : (

          /* Active Chat Messages Stream */
          <>
            <div
              ref={chatScrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 pt-16 pb-4 space-y-4"
            >
              <div className="max-w-2xl mx-auto w-full">
                {activeSession.messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    theme={currentTheme}
                    onSendToChat={handleSendMessage}
                    onSendToScratchpad={handleSendToScratchpad}
                    onRegenerate={handleRegenerate}
                    onEditAndResend={handleEditAndResend}
                  />
                ))}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>

            {/* Floating Scroll to Bottom Button */}
            {showScrollBottom && (
              <button
                onClick={() => scrollToBottom(true)}
                title="Scroll to bottom"
                className="absolute bottom-24 right-8 z-20 p-2.5 rounded-full bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 shadow-xl transition-all cursor-pointer active:scale-90"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            )}

            {/* Bottom Docked Input / Claude Question Sheet */}
            <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 pb-2">
              <AnimatePresence mode="wait">
                {activeQuestion ? (
                  <ClaudeQuestionSheet
                    key={`q-${latestMessage?.id || "active"}`}
                    question={activeQuestion}
                    onSelectOption={(answer) => {
                      handleSendMessage(answer);
                    }}
                    onDismiss={() => {
                      if (latestMessage) {
                        setDismissedQuestionIds((prev) => new Set(prev).add(latestMessage.id));
                      }
                    }}
                  />
                ) : (
                  <motion.div
                    key="chat-input-bar"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  >
                    <ChatInput
                      onSendMessage={handleSendMessage}
                      onStopStreaming={handleStopStreaming}
                      isStreaming={isStreaming}
                      theme={currentTheme}
                      isFocusMode={isFocusMode}
                      onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
                      selectedPersonaName={selectedPersona.name}
                      isHeroMode={false}
                      currentModelId={activeSession.model || "JOM-AGENT"}
                      onSelectModel={(model) => {
                        setSessions((prev) =>
                          prev.map((s) => (s.id === activeSession.id ? { ...s, model } : s))
                        );
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={currentTheme}
        onSelectTheme={setThemeId}
        session={activeSession}
        onUpdateSessionSettings={(settings) => {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSession.id
                ? {
                    ...s,
                    ...settings,
                  }
                : s
            )
          );
          showToast("บันทึกการตั้งค่าแล้ว", "success");
        }}
        onExportMarkdown={handleExportMarkdown}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onResetAllData={handleResetAllData}
      />
    </div>
  );
}
