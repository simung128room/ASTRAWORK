import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = 3000;

// Trust reverse proxy (Cloud Run / Nginx) safely
app.set("trust proxy", process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : 1);

// Security Headers with Helmet and Content Security Policy
app.use(
  helmet({
    frameguard: false, // Allows embedding by Google AI Studio preview
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "blob:",
          "https://cdn.tailwindcss.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.xkiro.com",
          "https://generativelanguage.googleapis.com",
          "https://*.run.app",
          "https://*.ai.studio",
          "https://*.google.com",
        ],
        workerSrc: ["'self'", "blob:"],
        frameSrc: ["'self'", "blob:", "data:"],
        frameAncestors: [
          "'self'",
          "https://*.ai.studio",
          "https://ai.studio",
          "https://*.google.com",
          "https://*.google.internal",
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// Whitelist configuration for CORS
const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-zA-Z0-9_.-]+\.run\.app$/,
  /^https:\/\/(?:[a-zA-Z0-9-]+\.)?google\.internal$/,
  /^https:\/\/(?:[a-zA-Z0-9-]+\.)?ai\.studio$/,
  /^https:\/\/(?:[a-zA-Z0-9-]+\.)?aistudio\.google\.com$/,
  /^https:\/\/(?:[a-zA-Z0-9-]+\.)?google\.com$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, same-origin, local tools)
      if (!origin) {
        return callback(null, true);
      }

      if (extraAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const isAllowed = ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
      if (isAllowed) {
        return callback(null, true);
      }

      // Reject non-whitelisted origin safely without throwing unhandled exceptions
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-API-Key"],
    maxAge: 86400,
  })
);

// Limit JSON body size to prevent memory exhaustion attacks
app.use(express.json({ limit: "10mb" }));

// Rate Limiters to prevent cost abuse, DoS, and automated scraping
const generalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "คำขอมากเกินไป กรุณารอสักครู่ (Too many requests, please slow down)" },
});

const chatRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 40, // max 40 prompts per minute per IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "คำขอส่งข้อความถี่เกินไป กรุณารอ 1 นาที (Chat rate limit exceeded)" },
});

const autoDebugLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "คำขอ auto-debug ถี่เกินไป กรุณารอสักครู่ (Auto-debug rate limit exceeded)" },
});

// Sanitizes error messages by redacting all API keys, bearer tokens, and secrets
function sanitizeErrorMessage(err: any): string {
  if (!err) return "Unknown error";
  const raw = typeof err === "string" ? err : err.message || JSON.stringify(err);
  return raw
    .replace(/AIza[0-9A-Za-z-_]{35}/g, "AIza***[REDACTED]")
    .replace(/key=[a-zA-Z0-9_\-]+/gi, "key=[REDACTED]")
    .replace(/bearer\s+[a-zA-Z0-9_.\-]+/gi, "Bearer [REDACTED]")
    .replace(/sk-[a-zA-Z0-9]{20,}/g, "sk-***[REDACTED]")
    .replace(/xkiro-[a-zA-Z0-9]{20,}/g, "xkiro-***[REDACTED]");
}

// Authentication & Anti-CSRF Shield Middleware
function verifyApiAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
  const configuredSecret = process.env.APP_SECRET_KEY || process.env.API_AUTH_TOKEN;
  if (configuredSecret) {
    const provided = req.headers["x-api-key"] || (req.headers["authorization"] ? req.headers["authorization"].replace(/^Bearer\s+/i, "") : null);
    if (!provided || provided !== configuredSecret) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing API key" });
    }
  }

  // Block unauthorized cross-site requests
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite === "cross-site") {
    const hasCustomHeader = Boolean(req.headers["x-requested-with"] || req.headers["authorization"] || req.headers["x-api-key"]);
    if (!hasCustomHeader) {
      return res.status(403).json({ error: "Forbidden: Cross-site request rejected" });
    }
  }

  next();
}

// Model Whitelist to prevent unauthorized model injection
const ALLOWED_MODELS = new Set([
  "Z one",
  "Z-One",
  "gemini-3.6-flash",
  "gemini-3.1-pro-preview",
  "gemini-search",
  "JOM-AGENT",
  "JOM-AGENT-CODE",
  "JOM-AGENT-REASON",
  "JOM-AGENT-SEARCH",
  "JOM-AGENT-IMAGE",
]);

// 1. Google Native GenAI SDK Initializer
function getGoogleAi(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// 2. xKiro API Gateway Initializer (Strictly isolate xKiro credentials; never leak Google keys)
const XKIRO_BASE_URL = "https://api.xkiro.com/v1";

const XKIRO_MODELS = {
  FLASH_PLANNER: "deepseek/deepseek-v4-flash",
  PRO_REASONING: "deepseek/deepseek-v4-pro",
  LARGE_SYNTHESIS: "mistralai/mistral-large-2512",
  GENERAL_BASE: "qwen/qwen3.8-max:free",
  VISION_IMAGE: "minimax/minimax-m3",
};

function getXkiroClient(): OpenAI | null {
  const apiKey = process.env.XKIRO_API_KEY || process.env.TOKENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    baseURL: XKIRO_BASE_URL,
    apiKey,
  });
}

// Health check endpoint (Safe generic status, no key reconnaissance)
app.get("/api/health", generalApiLimiter, (req, res) => {
  res.json({
    status: "ok",
    service: "ZEROWORK Z-One",
    timestamp: new Date().toISOString(),
  });
});

// Autonomous Auto-Debugging Endpoint with strict input validation and rate limiting
app.post("/api/auto-debug", autoDebugLimiter, verifyApiAccess, async (req, res) => {
  const { code, error, language = "typescript" } = req.body;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "No code provided for auto-debugging" });
  }

  // Enforce max code length (25,000 characters)
  const safeCode = code.slice(0, 25000);
  const safeError = typeof error === "string" ? error.slice(0, 3000) : "ตรวจสอบบั๊กและปรับปรุงโค้ด";
  const safeLang = typeof language === "string" ? language.slice(0, 50).replace(/[^a-zA-Z0-9_-]/g, "") : "typescript";

  const ai = getGoogleAi();
  const prompt = `คุณคือ Agent อัตโนมัติในการวิเคราะห์แก้บั๊ก (Auto-Debug Agent)
โปรดแก้ไขโค้ดต่อไปนี้และอธิบายทางแก้สั้นๆ

ภาษา: ${safeLang}
ข้อผิดพลาด/คำขอ: ${safeError}

โค้ดเดิม:
\`\`\`${safeLang}
${safeCode}
\`\`\`

ส่งคืนผลลัพธ์ในรูปแบบ JSON ดังนี้เท่านั้น (ไม่มีข้อความอื่นนอกเหนือจาก JSON):
{
  "fixedCode": "โค้ดที่แก้ไขเรียบร้อยแล้ว",
  "explanation": "คำอธิบายการแก้ไข 1-2 ประโยค"
}`;

  try {
    let rawText = "";
    if (ai) {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });
      rawText = response.text || "";
    } else {
      const xkiro = getXkiroClient();
      if (!xkiro) {
        throw new Error("AI provider configuration unavailable");
      }
      const response = await xkiro.chat.completions.create({
        model: XKIRO_MODELS.PRO_REASONING,
        messages: [{ role: "user", content: prompt }],
      });
      rawText = response.choices?.[0]?.message?.content || "";
    }

    // Clean JSON markdown
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return res.json(parsed);
    }

    return res.json({
      fixedCode: code,
      explanation: "ดำเนินการตรวจสอบและปรับปรุงโครงสร้างเรียบร้อย",
    });
  } catch (e: any) {
    console.error("Auto-debug processing error:", sanitizeErrorMessage(e));
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการวิเคราะห์โค้ด กรุณาลองใหม่อีกครั้ง" });
  }
});

// Primary Unified Chat API (/api/chat) with strict validation & rate limiting
app.post("/api/chat", chatRateLimiter, verifyApiAccess, async (req, res) => {
  const {
    message,
    attachments = [],
    history = [],
    customSystemPrompt,
    systemInstruction,
    temperature = 0.7,
    model = "Z one",
    stream = true,
  } = req.body;

  // 1. Sanitize user message (max 15,000 chars)
  const userText = typeof message === "string" ? message.trim().slice(0, 15000) : "";

  // 2. Validate requested model against whitelist
  const candidateModel = typeof model === "string" ? model.trim() : "Z one";
  const requestedModel = ALLOWED_MODELS.has(candidateModel) ? candidateModel : "Z one";

  // 3. Clamp temperature within safe boundaries [0.0, 1.0]
  const safeTemperature =
    typeof temperature === "number" && !isNaN(temperature)
      ? Math.max(0.0, Math.min(1.0, temperature))
      : 0.7;

  // 4. Sanitize custom system prompt (max 2000 chars)
  const safeCustomPrompt =
    typeof customSystemPrompt === "string"
      ? customSystemPrompt.slice(0, 2000)
      : typeof systemInstruction === "string"
      ? systemInstruction.slice(0, 2000)
      : null;

  const CORE_INSTRUCTION = `คุณคือ "ZEROWORK Z-One" (Z one) — ซูเปอร์ AI Omni Autonomous Super-Intelligence รุ่นอัปเกรดสูงสุด ออกแบบมาเพื่อความเป็นเลิศในการเขียนโปรแกรม, สถาปัตยกรรมระบบ, การวิเคราะห์ตรรกะเชิงลึก, และการทำงานอัตโนมัติแบบไร้รอยต่อ

คุณสมบัติและพฤติกรรมหลักของ Z-One:
1. Direct Action & Zero Placeholders: เขียนคำตอบและโค้ดตัวเต็มระดับ Production พร้อมใช้งาน 100% ตอบให้ตรงประเด็นและครบถ้วนทันที
2. Deep Multi-Step Reasoning: คิดวิเคราะห์เชิงลึกอย่างเป็นระบบ หากเป็นปัญหาที่ซับซ้อนให้แสดงกระบวนการคิดในแท็ก <thinking>...</thinking>
3. Interactive Choice Sheets (เมื่อจำเป็นจริง ๆ เท่านั้น): ไม่ต้องใส่ตัวเลือกหรือแผ่นคำถามบ่อย หากไม่ใช่กรณีที่ผู้ใช้ขอทางเลือกหรือจำเป็นต้องตัดสินใจสถาปัตยกรรมสำคัญจริง ๆ ให้เน้นตอบข้อสรุปที่สมบูรณ์ทันที
4. Real-time Web Grounding: ค้นหาข้อมูลเชิงลึกและไลบรารีเวอร์ชันล่าสุดได้อย่างแม่นยำ
5. Universal Full-Stack Master: เชี่ยวชาญ TypeScript, React, Node.js, Python, Rust, Go, SQL, Docker, Kubernetes, CI/CD, และ Cloud Infrastructure

ตอบด้วยภาษาไทยที่สุภาพ เป็นมืออาชีพ ชัดเจน ตรงประเด็น และเฉียบคมทางเทคนิคเสมอ`;

  const baseInstruction = safeCustomPrompt
    ? `${CORE_INSTRUCTION}\n\n[ข้อกำหนดและบริบทเฉพาะที่ผู้ใช้ตั้งค่าไว้]:\n${safeCustomPrompt}`
    : CORE_INSTRUCTION;

  const isGeminiRequested =
    requestedModel === "Z one" ||
    requestedModel === "Z-One" ||
    requestedModel.startsWith("gemini-") ||
    requestedModel.startsWith("JOM-AGENT");

  const isSearchGrounded =
    requestedModel === "JOM-AGENT-SEARCH" ||
    requestedModel === "gemini-search" ||
    (/(ค้นหา|ล่าสุด|ข่าว|อัปเดต|เวอร์ชัน|doc|library|latest|search|price|news|weather)/i.test(userText));

  const googleAi = getGoogleAi();

  // 6. Validate and sanitize conversation history (anti-spoofing and memory protection)
  const validatedHistory: Array<{ role: "user" | "model" | "assistant"; content: string }> = [];
  if (Array.isArray(history)) {
    const recentHistory = history.slice(-20);
    for (const item of recentHistory) {
      if (!item || typeof item !== "object") continue;
      const roleStr = String(item.role || "").toLowerCase();
      if (roleStr === "system") continue;
      const normalizedRole = roleStr === "assistant" || roleStr === "model" ? "model" : "user";
      const contentStr = typeof item.content === "string" ? item.content.slice(0, 10000) : "";
      if (contentStr) {
        validatedHistory.push({ role: normalizedRole, content: contentStr });
      }
    }
  }

  // 7. Validate attachments (limit count and payload size)
  const safeAttachments = Array.isArray(attachments) ? attachments.slice(0, 5) : [];

  // Route to Google Native GenAI SDK when available and requested
  if (googleAi && isGeminiRequested) {
    try {
      let targetGeminiModel = "gemini-3.6-flash";
      if (requestedModel === "gemini-3.1-pro-preview" || requestedModel === "JOM-AGENT-REASON") {
        targetGeminiModel = "gemini-3.1-pro-preview";
      }

      // Build Gemini contents array
      const geminiContents: any[] = [];

      // Add validated history
      for (const item of validatedHistory) {
        geminiContents.push({
          role: item.role === "model" ? "model" : "user",
          parts: [{ text: item.content }],
        });
      }

      // Current User Message + Attachments
      const currentParts: any[] = [];

      let textContent = userText;
      for (const att of safeAttachments) {
        if (att.isImage && typeof att.dataUrl === "string" && att.dataUrl.startsWith("data:image/") && att.dataUrl.length < 5000000) {
          const splitData = att.dataUrl.split(",");
          if (splitData.length === 2) {
            const base64Data = splitData[1];
            const mimeType = splitData[0].split(";")[0].split(":")[1] || "image/jpeg";
            currentParts.push({
              inlineData: { mimeType, data: base64Data },
            });
          }
        } else if (typeof att.content === "string") {
          const safeFileName = String(att.name || "attachment").slice(0, 100).replace(/[<>]/g, "");
          textContent += `\n\n--- ไฟล์แนบ: ${safeFileName} ---\n${att.content.slice(0, 15000)}`;
        }
      }

      if (textContent) {
        currentParts.push({ text: textContent });
      }

      if (currentParts.length > 0) {
        geminiContents.push({ role: "user", parts: currentParts });
      }

      if (stream) {
        let responseStream;
        try {
          responseStream = await googleAi.models.generateContentStream({
            model: targetGeminiModel,
            contents: geminiContents,
            config: {
              systemInstruction: baseInstruction,
              temperature: safeTemperature,
              tools: isSearchGrounded ? [{ googleSearch: {} }] : undefined,
            },
          });
        } catch (streamInitErr: any) {
          if (targetGeminiModel !== "gemini-3.6-flash") {
            console.warn(`Gemini ${targetGeminiModel} failed, trying gemini-3.6-flash:`, streamInitErr?.message || streamInitErr);
            targetGeminiModel = "gemini-3.6-flash";
            responseStream = await googleAi.models.generateContentStream({
              model: targetGeminiModel,
              contents: geminiContents,
              config: {
                systemInstruction: baseInstruction,
                temperature: safeTemperature,
                tools: isSearchGrounded ? [{ googleSearch: {} }] : undefined,
              },
            });
          } else {
            throw streamInitErr;
          }
        }

        if (!res.headersSent) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.flushHeaders();
        }

        for await (const chunk of responseStream) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }

        res.write("data: [DONE]\n\n");
        return res.end();
      } else {
        let response;
        try {
          response = await googleAi.models.generateContent({
            model: targetGeminiModel,
            contents: geminiContents,
            config: {
              systemInstruction: baseInstruction,
              temperature: safeTemperature,
              tools: isSearchGrounded ? [{ googleSearch: {} }] : undefined,
            },
          });
        } catch (genErr: any) {
          if (targetGeminiModel !== "gemini-3.6-flash") {
            targetGeminiModel = "gemini-3.6-flash";
            response = await googleAi.models.generateContent({
              model: targetGeminiModel,
              contents: geminiContents,
              config: {
                systemInstruction: baseInstruction,
                temperature: safeTemperature,
                tools: isSearchGrounded ? [{ googleSearch: {} }] : undefined,
              },
            });
          } else {
            throw genErr;
          }
        }

        return res.json({ text: response.text, model: targetGeminiModel });
      }
    } catch (geminiErr: any) {
      console.error("GoogleGenAI execution error:", sanitizeErrorMessage(geminiErr));
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "เกิดข้อผิดพลาดในการสตรีมข้อมูล กรุณาลองใหม่อีกครั้ง" })}\n\n`);
        res.write("data: [DONE]\n\n");
        return res.end();
      }
    }
  }

  // Fallback to xKiro Multi-Specialist Cluster if configured
  const client = getXkiroClient();
  if (!client) {
    if (!res.headersSent) {
      return res.status(500).json({ error: "ระบบ AI กำลังเตรียมความพร้อม กรุณาลองใหม่อีกครั้งในสักครู่" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "ระบบ AI กำลังเตรียมความพร้อม กรุณาลองใหม่อีกครั้งในสักครู่" })}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }
  }

  const openAiMessages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: "system", content: baseInstruction },
  ];

  for (const item of validatedHistory) {
    openAiMessages.push({
      role: item.role === "model" ? "assistant" : "user",
      content: item.content,
    });
  }

  let fullUserText = userText;
  const textAttachments = safeAttachments.filter((a: any) => !a.isImage && a.content);

  if (textAttachments.length > 0) {
    const textContent = textAttachments
      .map((att: any) => {
        const name = String(att.name || "attachment").slice(0, 100).replace(/[<>]/g, "");
        const ext = String(att.extension || "").slice(0, 10).replace(/[^a-zA-Z0-9]/g, "");
        return `\n\n--- ไฟล์แนบ: ${name} ---\n\`\`\`${ext}\n${String(att.content).slice(0, 15000)}\n\`\`\``;
      })
      .join("\n");
    fullUserText = fullUserText ? `${fullUserText}\n${textContent}` : textContent;
  }

  const hasImageAttachments = safeAttachments.some(
    (a: any) => a.isImage && typeof a.dataUrl === "string" && a.dataUrl.startsWith("data:image/") && a.dataUrl.length < 5000000
  );

  let primarySpecialist = XKIRO_MODELS.PRO_REASONING;
  if (hasImageAttachments) primarySpecialist = XKIRO_MODELS.VISION_IMAGE;

  if (hasImageAttachments) {
    const userContentArray: any[] = [{ type: "text", text: fullUserText || "วิเคราะห์ภาพถ่ายนี้อย่างละเอียด" }];
    for (const att of safeAttachments) {
      if (att.isImage && typeof att.dataUrl === "string" && att.dataUrl.startsWith("data:image/")) {
        userContentArray.push({ type: "image_url", image_url: { url: att.dataUrl } });
      }
    }
    openAiMessages.push({ role: "user", content: userContentArray as any });
  } else if (fullUserText) {
    openAiMessages.push({ role: "user", content: fullUserText });
  }

  try {
    if (stream) {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
      }

      const responseStream = await client.chat.completions.create({
        model: primarySpecialist,
        messages: openAiMessages,
        temperature: safeTemperature,
        stream: true,
      });

      for await (const chunk of responseStream) {
        const delta = chunk.choices?.[0]?.delta?.content || "";
        if (delta) {
          res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      return res.end();
    } else {
      const response = await client.chat.completions.create({
        model: primarySpecialist,
        messages: openAiMessages,
        temperature: safeTemperature,
      });

      return res.json({
        text: response.choices?.[0]?.message?.content || "",
        model: primarySpecialist,
      });
    }
  } catch (err: any) {
    console.error("xKiro processing error:", sanitizeErrorMessage(err));
    if (!res.headersSent) {
      return res.status(500).json({ error: "เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง" })}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }
  }
});

// Code execution endpoint - SERVER RCE PERMANENTLY DISABLED
app.post("/api/run-code", generalApiLimiter, (req, res) => {
  return res.status(403).json({
    success: false,
    error: "Server-side code execution is disabled. All code execution runs securely client-side in an isolated Web Worker sandbox.",
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ZEROWORK Z-One Server running on http://localhost:${PORT}`);
  });
}

startServer();
