import React, { useState, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ onTranscript }) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "th-TH"; // Default Thai speech input

        rec.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          if (text) {
            onTranscript(text);
          }
          setIsListening(false);
        };

        rec.onerror = (err: any) => {
          console.warn("Speech recognition error:", err);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        setRecognition(rec);
      }
    }
  }, [onTranscript]);

  const [notSupported, setNotSupported] = useState(false);

  const toggleListening = () => {
    if (!recognition) {
      setNotSupported(true);
      setTimeout(() => setNotSupported(false), 3000);
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        recognition.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="relative inline-flex items-center">
      {notSupported && (
        <span className="absolute -top-8 right-0 whitespace-nowrap px-2 py-1 text-[11px] bg-zinc-900 border border-amber-500/40 text-amber-300 rounded-md shadow-lg pointer-events-none z-50">
          เบราว์เซอร์นี้ไม่รองรับ Speech Recognition
        </span>
      )}
      <button
        type="button"
        onClick={toggleListening}
        title={isListening ? "กำลังฟังเสียงของคุณ... (กดเพื่อหยุด)" : "พิมพ์ด้วยเสียง (Voice Input)"}
        className={`p-2 rounded-xl transition-all cursor-pointer relative ${
          isListening
            ? "bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse"
            : "text-zinc-400 hover:text-white hover:bg-zinc-800"
        }`}
      >
        {isListening ? (
          <>
            <MicOff className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
          </>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};
