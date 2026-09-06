import React, { useState, useEffect } from "react";

export const DynamicGreeting: React.FC = () => {
  const [greetingText, setGreetingText] = useState("");
  const [isFading, setIsFading] = useState(false);

  // Helper to determine time-of-day greeting prefix
  const getTimePrefix = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return "สวัสดีตอนเช้าครับ";
    } else if (hour >= 12 && hour < 16) {
      return "สวัสดีตอนบ่ายครับ";
    } else if (hour >= 16 && hour < 20) {
      return "สวัสดีตอนเย็นครับ";
    } else {
      return "สวัสดีตอนดึกครับ";
    }
  };

  useEffect(() => {
    const greetings = [
      getTimePrefix(),
      "วันนี้มีเรื่องอะไรให้ NEXA ช่วยดูแลบ้างครับ",
      "ถามตอบทั่วไป ปรึกษาไอเดีย หรือเขียนโปรแกรมได้ทันที",
      "NEXA ผู้ช่วยรอบด้าน คุยได้ทุกเรื่อง และเชี่ยวชาญการเขียนโค้ด",
    ];
    let idx = 0;
    setGreetingText(greetings[0]);

    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        idx = (idx + 1) % greetings.length;
        setGreetingText(greetings[idx]);
        setIsFading(false);
      }, 300); // 300ms fade transition
    }, 4500); // Switch every 4.5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-16 sm:h-20 flex items-center justify-center px-4">
      <h1
        className={`font-prompt text-2xl sm:text-3xl md:text-4xl font-semibold text-white leading-tight tracking-tight text-center transition-all duration-300 transform ${
          isFading ? "opacity-0 scale-95 translate-y-1" : "opacity-100 scale-100 translate-y-0"
        }`}
      >
        {greetingText}
      </h1>
    </div>
  );
};
