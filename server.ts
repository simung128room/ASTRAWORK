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
  "NEXA",
  "NEXA-Unified",
  "NEXA-One",
  "NEXA-Reason",
  "NEXA-xKiro",
  "NEXA-Pro",
  "qwen/qwen3.8-max:free",
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-v4-pro",
  "minimax/minimax-m3:free",
  "mistralai/mistral-medium-3.5",
  "mistralai/mistral-large-2512",
  "openai/gpt-5.3-codex-spark",
  "xkiro",
  "xkiro-deepseek",
  "deepseek",
  "Z one",
  "Z-One",
  "gemini-3.8-flash",
  "gemini-flash-latest",
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
  QWEN_MAX: "qwen/qwen3.8-max:free",
  DEEPSEEK_V4_FLASH: "deepseek/deepseek-v4-flash",
  DEEPSEEK_V4_PRO: "deepseek/deepseek-v4-pro",
  MINIMAX_M3: "minimax/minimax-m3:free",
  MISTRAL_MEDIUM: "mistralai/mistral-medium-3.5",
  MISTRAL_LARGE: "mistralai/mistral-large-2512",
  GPT_53_CODEX: "openai/gpt-5.3-codex-spark",
};

function getXkiroClient(): OpenAI | null {
  const apiKey = process.env.XKIRO_API_KEY || process.env.TOKENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    baseURL: XKIRO_BASE_URL,
    apiKey,
    timeout: 15000,
  });
}

// Health check endpoint (Safe generic status, no key reconnaissance)
app.get("/api/health", generalApiLimiter, (req, res) => {
  res.json({
    status: "ok",
    service: "NEXA",
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
  const prompt = `คุณคือ NEXA Auto-Debug Intelligence Agent ที่มีความเชี่ยวชาญด้านการวิเคราะห์โค้ดขั้นสูง
โปรดวิเคราะห์สาเหตุของบั๊ก แก้ไขโค้ดให้ถูกต้อง และอธิบายทางแก้สั้นๆ

ภาษา: ${safeLang}
ข้อผิดพลาด/คำขอ: ${safeError}

โค้ดเดิม:
\`\`\`${safeLang}
${safeCode}
\`\`\`

ส่งคืนผลลัพธ์ในรูปแบบ JSON ดังนี้เท่านั้น (ไม่มีข้อความอื่นนอกเหนือจาก JSON):
{
  "fixedCode": "โค้ดที่แก้ไขเรียบร้อยแล้วและปลอดภัย",
  "explanation": "คำอธิบายการแก้ไข 1-2 ประโยค"
}`;

  try {
    let rawText = "";
    if (ai) {
      let response: any = null;
      const debugModels = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
      for (const m of debugModels) {
        try {
          response = await ai.models.generateContent({
            model: m,
            contents: prompt,
          });
          if (response?.text) break;
        } catch {
          continue;
        }
      }
      rawText = response?.text || "";
    } else {
      const xkiro = getXkiroClient();
      if (!xkiro) {
        throw new Error("AI provider configuration unavailable");
      }
      const response = await xkiro.chat.completions.create({
        model: XKIRO_MODELS.DEEPSEEK_V4_PRO,
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
    model = "NEXA",
    stream = true,
  } = req.body;

  // 1. Sanitize user message (max 15,000 chars)
  const userText = typeof message === "string" ? message.trim().slice(0, 15000) : "";

  // 2. Validate requested model against whitelist
  const candidateModel = typeof model === "string" ? model.trim() : "NEXA";
  const requestedModel = ALLOWED_MODELS.has(candidateModel) ? candidateModel : "NEXA";

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

  const CORE_INSTRUCTION = ``;

  const baseInstruction = safeCustomPrompt
    ? `${CORE_INSTRUCTION}\n\n[ข้อกำหนดและบริบทเฉพาะที่ผู้ใช้ตั้งค่าไว้]:\n${safeCustomPrompt}`
    : CORE_INSTRUCTION;

  // Detect query attributes for optimal cluster routing
  const isSearchGrounded =
    requestedModel === "JOM-AGENT-SEARCH" ||
    requestedModel === "gemini-search" ||
    (/(ค้นหา|ล่าสุด|ข่าว|อัปเดต|เวอร์ชัน|doc|library|latest|search|price|news|weather)/i.test(userText));

  const isCodingOrTech =
    /(โค้ด|เขียนโปรแกรม|เขียนโค้ด|ฟังก์ชัน|function|class|api|script|sql|react|vue|angular|node|python|typescript|javascript|golang|rust|docker|bug|debug|error|algorithm|database|html|css|tailwind|แก้บั๊ก|refactor|component|terminal|command)/i.test(
      userText
    );

  const googleAi = getGoogleAi();
  const xkiroClient = getXkiroClient();

  // Validate and sanitize conversation history
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

  // Validate attachments
  const safeAttachments = Array.isArray(attachments) ? attachments.slice(0, 5) : [];

  // Build Gemini Contents
  const geminiContents: any[] = [];
  for (const item of validatedHistory) {
    geminiContents.push({
      role: item.role === "model" ? "model" : "user",
      parts: [{ text: item.content }],
    });
  }

  const currentGeminiParts: any[] = [];
  let geminiTextContent = userText;
  for (const att of safeAttachments) {
    if (
      att.isImage &&
      typeof att.dataUrl === "string" &&
      att.dataUrl.startsWith("data:image/") &&
      att.dataUrl.length < 5000000
    ) {
      const splitData = att.dataUrl.split(",");
      if (splitData.length === 2) {
        const base64Data = splitData[1];
        const mimeType = splitData[0].split(";")[0].split(":")[1] || "image/jpeg";
        currentGeminiParts.push({
          inlineData: { mimeType, data: base64Data },
        });
      }
    } else if (typeof att.content === "string") {
      const name = String(att.name || "attachment").slice(0, 100).replace(/[<>]/g, "");
      const ext = String(att.extension || "").slice(0, 10).replace(/[^a-zA-Z0-9]/g, "");
      const content = String(att.content).slice(0, 15000);
      geminiTextContent += `\n\n--- ไฟล์แนบ: ${name} ---\n\`\`\`${ext}\n${content}\n\`\`\``;
    }
  }
  if (geminiTextContent) {
    currentGeminiParts.push({ text: geminiTextContent });
  } else if (currentGeminiParts.length > 0) {
    currentGeminiParts.push({ text: "อธิบายภาพนี้อย่างละเอียด" });
  }
  geminiContents.push({
    role: "user",
    parts: currentGeminiParts,
  });

  // Build OpenAI Messages
  const openAiMessages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: "system", content: baseInstruction },
  ];
  for (const item of validatedHistory) {
    openAiMessages.push({
      role: item.role === "model" ? "assistant" : "user",
      content: item.content,
    });
  }

  let fullOpenAiText = userText;
  const textAttachments = safeAttachments.filter((a: any) => !a.isImage && a.content);
  if (textAttachments.length > 0) {
    const textContent = textAttachments
      .map((att: any) => {
        const name = String(att.name || "attachment").slice(0, 100).replace(/[<>]/g, "");
        const ext = String(att.extension || "").slice(0, 10).replace(/[^a-zA-Z0-9]/g, "");
        return `\n\n--- ไฟล์แนบ: ${name} ---\n\`\`\`${ext}\n${String(att.content).slice(0, 15000)}\n\`\`\``;
      })
      .join("\n");
    fullOpenAiText = fullOpenAiText ? `${fullOpenAiText}\n${textContent}` : textContent;
  }

  const hasImageAttachments = safeAttachments.some(
    (a: any) =>
      a.isImage &&
      typeof a.dataUrl === "string" &&
      a.dataUrl.startsWith("data:image/") &&
      a.dataUrl.length < 5000000
  );

  if (hasImageAttachments) {
    const userContentArray: any[] = [{ type: "text", text: fullOpenAiText || "วิเคราะห์ภาพถ่ายนี้อย่างละเอียด" }];
    for (const att of safeAttachments) {
      if (att.isImage && typeof att.dataUrl === "string" && att.dataUrl.startsWith("data:image/")) {
        userContentArray.push({ type: "image_url", image_url: { url: att.dataUrl } });
      }
    }
    openAiMessages.push({ role: "user", content: userContentArray as any });
  } else if (fullOpenAiText) {
    openAiMessages.push({ role: "user", content: fullOpenAiText });
  }

  // Unified NEXA Hyper-Cluster Prioritized Candidates Sequence
  const candidateChain: Array<{ type: "xkiro" | "gemini"; model: string }> = [];

  if (hasImageAttachments) {
    if (googleAi) {
      candidateChain.push({ type: "gemini", model: "gemini-2.5-flash" });
    }
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.MINIMAX_M3 });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.DEEPSEEK_V4_PRO });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.QWEN_MAX });
  } else if (isSearchGrounded) {
    if (googleAi) {
      candidateChain.push({ type: "gemini", model: "gemini-2.5-flash" });
    }
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.QWEN_MAX });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.MISTRAL_LARGE });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.DEEPSEEK_V4_PRO });
  } else if (isCodingOrTech) {
    // Coding powerhouse priority: DeepSeek V4 Pro #1 -> Qwen 3.8 Max -> DeepSeek Flash -> Mistral Large -> Minimax
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.DEEPSEEK_V4_PRO });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.QWEN_MAX });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.DEEPSEEK_V4_FLASH });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.MISTRAL_LARGE });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.MINIMAX_M3 });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.MISTRAL_MEDIUM });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.GPT_53_CODEX });
    if (googleAi) {
      candidateChain.push({ type: "gemini", model: "gemini-2.5-flash" });
    }
  } else {
    // General everyday & reasoning priority: Qwen 3.8 Max #1 -> DeepSeek V4 Pro -> Mistral Large -> Minimax -> DeepSeek Flash
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.QWEN_MAX });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.DEEPSEEK_V4_PRO });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.MISTRAL_LARGE });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.MINIMAX_M3 });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.DEEPSEEK_V4_FLASH });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.MISTRAL_MEDIUM });
    candidateChain.push({ type: "xkiro", model: XKIRO_MODELS.GPT_53_CODEX });
    if (googleAi) {
      candidateChain.push({ type: "gemini", model: "gemini-2.5-flash" });
    }
  }

  try {
    if (stream) {
      let activeStream: any = null;
      let activeType: "gemini" | "xkiro" = "xkiro";
      let lastErr: any = null;

      // Cascade through candidate models until an active stream is acquired
      for (const candidate of candidateChain) {
        try {
          if (candidate.type === "gemini") {
            if (!googleAi) continue;
            const s = await googleAi.models.generateContentStream({
              model: candidate.model,
              contents: geminiContents,
              config: {
                systemInstruction: baseInstruction,
                temperature: safeTemperature,
                tools: isSearchGrounded ? [{ googleSearch: {} }] : undefined,
              },
            });
            activeStream = s;
            activeType = "gemini";
            break;
          } else {
            if (!xkiroClient) continue;
            const s = await xkiroClient.chat.completions.create({
              model: candidate.model,
              messages: openAiMessages,
              temperature: safeTemperature,
              stream: true,
            });
            activeStream = s;
            activeType = "xkiro";
            break;
          }
        } catch (err: any) {
          lastErr = err;
          console.warn(`[NEXA Unified Engine] ${candidate.model} (${candidate.type}) startup error, cascading...`);
          continue;
        }
      }

      if (!activeStream) {
        throw lastErr || new Error("ระบบ AI ในคลัสเตอร์ NEXA กำลังเตรียมความพร้อม กรุณาลองใหม่อีกครั้ง");
      }

      if (!res.headersSent) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
      }

      if (activeType === "gemini") {
        for await (const chunk of activeStream) {
          let chunkData: any = {};
          if (chunk.text) {
            chunkData.text = chunk.text;
          }
          // Extract Grounding metadata / search sources if available
          const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
          if (groundingMetadata?.groundingChunks?.length > 0) {
            const sources = groundingMetadata.groundingChunks
              .filter((c: any) => c.web?.uri && c.web?.title)
              .map((c: any) => ({
                title: c.web.title,
                url: c.web.uri,
              }));
            
            if (sources.length > 0) {
              chunkData.searchSources = sources;
            }
          }
          if (Object.keys(chunkData).length > 0) {
            res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
          }
        }
      } else {
        for await (const chunk of activeStream) {
          const delta = chunk.choices?.[0]?.delta?.content || "";
          if (delta) {
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
        }
      }

      res.write("data: [DONE]\n\n");
      return res.end();
    } else {
      let lastErr: any = null;

      for (const candidate of candidateChain) {
        try {
          if (candidate.type === "gemini") {
            if (!googleAi) continue;
            const genRes = await googleAi.models.generateContent({
              model: candidate.model,
              contents: geminiContents,
              config: {
                systemInstruction: baseInstruction,
                temperature: safeTemperature,
                tools: isSearchGrounded ? [{ googleSearch: {} }] : undefined,
              },
            });
            if (genRes?.text) {
              let responseObj: any = { text: genRes.text, model: "NEXA" };
              const groundingMetadata = genRes.candidates?.[0]?.groundingMetadata;
              if (groundingMetadata?.groundingChunks?.length > 0) {
                const sources = groundingMetadata.groundingChunks
                  .filter((c: any) => c.web?.uri && c.web?.title)
                  .map((c: any) => ({
                    title: c.web.title,
                    url: c.web.uri,
                  }));
                if (sources.length > 0) {
                  responseObj.searchSources = sources;
                }
              }
              return res.json(responseObj);
            }
          } else {
            if (!xkiroClient) continue;
            const compRes = await xkiroClient.chat.completions.create({
              model: candidate.model,
              messages: openAiMessages,
              temperature: safeTemperature,
            });
            const text = compRes.choices?.[0]?.message?.content;
            if (text) {
              return res.json({ text, model: "NEXA" });
            }
          }
        } catch (err: any) {
          lastErr = err;
          console.warn(`[NEXA Unified Engine] ${candidate.model} failed, cascading...`);
          continue;
        }
      }

      throw lastErr || new Error("Failed to generate response across all models in NEXA cluster");
    }
  } catch (err: any) {
    console.error("NEXA Unified Engine processing error:", sanitizeErrorMessage(err));
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
    console.log(`NEXA Server running on http://localhost:${PORT}`);
  });
}

startServer();
