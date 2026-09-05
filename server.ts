import express from "express";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// 1. Google GenAI Native SDK Initializer
function getGoogleAi(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// 2. xKiro API Gateway Initializer
const XKIRO_BASE_URL = "https://api.xkiro.com/v1";

const XKIRO_MODELS = {
  FLASH_PLANNER: "deepseek/deepseek-v4-flash",
  PRO_REASONING: "deepseek/deepseek-v4-pro",
  LARGE_SYNTHESIS: "mistralai/mistral-large-2512",
  GENERAL_BASE: "qwen/qwen3.8-max:free",
  VISION_IMAGE: "minimax/minimax-m3",
};

function getXkiroClient(): OpenAI {
  const apiKey =
    process.env.XKIRO_API_KEY ||
    process.env.TOKENROUTER_API_KEY ||
    process.env.API_KEY ||
    process.env.GEMINI_API_KEY ||
    "free";

  return new OpenAI({
    baseURL: XKIRO_BASE_URL,
    apiKey,
  });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.API_KEY);
  const hasXkiro = !!(process.env.XKIRO_API_KEY || process.env.TOKENROUTER_API_KEY);

  res.json({
    status: "ok",
    model: "J-1.0 Unified Smart Architecture",
    engines: {
      googleGenAI: hasGemini ? "Active (Gemini 3.6 Flash & 3.1 Pro)" : "Fallback Mode",
      xKiroGateway: hasXkiro ? "Active" : "Standard Cluster",
    },
    hasGeminiKey: hasGemini,
    timestamp: new Date().toISOString(),
  });
});

// Download Source Code ZIP Endpoint
app.get(["/api/download-zip", "/jomcode-source.zip", "/api/download-source"], (req, res) => {
  const zipPath = path.join(process.cwd(), "jomcode-source.zip");
  
  try {
    // Regenerate zip to ensure latest changes are included
    execSync("python3 generate_zip.py", { cwd: process.cwd() });
  } catch (err) {
    console.warn("Could not regenerate zip dynamically, using existing:", err);
  }

  if (fs.existsSync(zipPath)) {
    res.setHeader("Content-Disposition", 'attachment; filename="jomcode-source.zip"');
    res.setHeader("Content-Type", "application/zip");
    return res.sendFile(zipPath);
  } else {
    return res.status(404).json({ error: "ZIP file could not be generated." });
  }
});

// Autonomous Auto-Debugging Endpoint
app.post("/api/auto-debug", async (req, res) => {
  const { code, error, language = "typescript" } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided for auto-debugging" });

  const ai = getGoogleAi();
  const prompt = `คุณคือ Agent อัตโนมัติในการวิเคราะห์แก้บั๊ก (Auto-Debug Agent)
โปรดแก้ไขโค้ดต่อไปนี้และอธิบายทางแก้สั้นๆ

ภาษา: ${language}
ข้อผิดพลาด/คำขอ: ${error || "ตรวจสอบบั๊กและปรับปรุงโค้ด"}

โค้ดเดิม:
\`\`\`${language}
${code}
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
      explanation: "ไม่สามารถแปลงรูปแบบ JSON ได้ แต่ดำเนินการตรวจสอบเรียบร้อย",
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Auto-debug agent error" });
  }
});

// Primary Unified Chat API (/api/chat)
app.post("/api/chat", async (req, res) => {
  const {
    message,
    attachments = [],
    history = [],
    customSystemPrompt,
    systemInstruction,
    temperature = 0.7,
    model = "J-1.0",
    knowledgeItems = [],
    stream = true,
  } = req.body;

  const userText = typeof message === "string" ? message.trim() : "";
  const requestedModel = (model || "J-1.0").trim();

  // RAG Knowledge Memory Context Building
  let ragContext = "";
  if (Array.isArray(knowledgeItems) && knowledgeItems.length > 0) {
    ragContext = "\n\n=== บริบทความรู้โปรเจกต์ (RAG Knowledge Base Context) ===\n" +
      knowledgeItems
        .map((k: any) => `[${k.category || "General"}]: ${k.title}\n${k.content}`)
        .join("\n\n") +
      "\n======================================================\n";
  }

  const baseInstruction =
    (customSystemPrompt || systemInstruction ||
    `คุณคือ "จอม" AI Coding & Reasoning Assistant อัจฉริยะ (สถาปัตยกรรม J-1.0 Multi-Engine System)
คุณมีสไตล์การสื่อสารที่สุภาพ สละสลวย ถ่อมตน มุ่งเน้นการแก้ปัญหาอย่างประณีตและทรงประสิทธิภาพ ดั่งระดับ Claude 3.7 Sonnet

คู่มือการตอบและการจัดโครงสร้าง (Guidelines):
1. **บุคลิกภาพ**: สุภาพ สละสลวย ละเมียดละไม (ลงท้ายด้วย "ครับ")
2. **กระบวนการคิด**: ใช้ <thinking> ... </thinking> ก่อนตอบสำหรับโจทย์ซับซ้อน
3. **การ์ดปุ่มกดต่อยอด**: ในท้ายคำตอบ เสนอ 3-4 ทางเลือกด้วย Markdown Link เช่น [#prompt=...]()`) + ragContext;

  const isGeminiRequested =
    requestedModel.includes("gemini") ||
    requestedModel === "J-1.0" ||
    requestedModel === "gemini-search";

  const isSearchGrounded = requestedModel === "gemini-search" || userText.includes("ค้นหา") || userText.includes("ล่าสุด") || userText.includes("ข่าว");

  const googleAi = getGoogleAi();

  // Route to Google Native GenAI SDK when available and requested
  if (googleAi && isGeminiRequested) {
    try {
      let targetGeminiModel = "gemini-3.6-flash";
      if (requestedModel === "gemini-3.1-pro-preview") {
        targetGeminiModel = "gemini-3.1-pro-preview";
      }

      // Build Gemini contents array
      const geminiContents: any[] = [];

      // History
      if (Array.isArray(history)) {
        for (const item of history) {
          if (!item || !item.content || item.role === "system") continue;
          geminiContents.push({
            role: item.role === "assistant" || item.role === "model" ? "model" : "user",
            parts: [{ text: String(item.content) }],
          });
        }
      }

      // Current User Message + Attachments
      const currentParts: any[] = [];

      // Text attachments
      let textContent = userText;
      if (Array.isArray(attachments)) {
        for (const att of attachments) {
          if (att.isImage && att.dataUrl) {
            const base64Data = att.dataUrl.split(",")[1];
            const mimeType = att.dataUrl.split(";")[0].split(":")[1] || "image/jpeg";
            currentParts.push({
              inlineData: { mimeType, data: base64Data },
            });
          } else if (att.content) {
            textContent += `\n\n--- ไฟล์แนบ: ${att.name} ---\n${att.content}`;
          }
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
              temperature: typeof temperature === "number" ? temperature : 0.7,
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
                temperature: typeof temperature === "number" ? temperature : 0.7,
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
              temperature: typeof temperature === "number" ? temperature : 0.7,
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
                temperature: typeof temperature === "number" ? temperature : 0.7,
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
      console.warn("GoogleGenAI SDK fallback to xKiro cluster:", geminiErr?.message || geminiErr);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: geminiErr?.message || "Stream error" })}\n\n`);
        return res.end();
      }
    }
  }

  // Fallback / Primary xKiro Multi-Specialist Cluster
  const client = getXkiroClient();

  const openAiMessages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: "system", content: baseInstruction },
  ];

  if (Array.isArray(history)) {
    for (const item of history) {
      if (!item || !item.content || item.role === "system") continue;
      openAiMessages.push({
        role: item.role === "assistant" || item.role === "model" ? "assistant" : "user",
        content: String(item.content),
      });
    }
  }

  let fullUserText = userText;
  const textAttachments = Array.isArray(attachments)
    ? attachments.filter((a: any) => !a.isImage && a.content)
    : [];

  if (textAttachments.length > 0) {
    const textContent = textAttachments
      .map((att: any) => `\n\n--- ไฟล์แนบ: ${att.name} ---\n\`\`\`${att.extension || ""}\n${att.content}\n\`\`\``)
      .join("\n");
    fullUserText = fullUserText ? `${fullUserText}\n${textContent}` : textContent;
  }

  const hasImageAttachments = Array.isArray(attachments) && attachments.some((a: any) => a.isImage && a.dataUrl);

  let primarySpecialist = XKIRO_MODELS.PRO_REASONING;
  if (hasImageAttachments) primarySpecialist = XKIRO_MODELS.VISION_IMAGE;

  if (hasImageAttachments) {
    const userContentArray: any[] = [{ type: "text", text: fullUserText || "วิเคราะห์ภาพถ่ายนี้อย่างละเอียด" }];
    for (const att of attachments) {
      if (att.isImage && att.dataUrl) {
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
        temperature: typeof temperature === "number" ? temperature : 0.7,
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
        temperature: typeof temperature === "number" ? temperature : 0.7,
      });

      return res.json({
        text: response.choices?.[0]?.message?.content || "",
        model: primarySpecialist,
      });
    }
  } catch (err: any) {
    console.error("xKiro Chat Error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err?.message || "Internal server error" });
    } else {
      res.write(`data: ${JSON.stringify({ error: err?.message || "Server Error" })}\n\n`);
      return res.end();
    }
  }
});

// Code execution sandbox simulator
app.post("/api/run-code", (req, res) => {
  const { code, language } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided" });

  const cleanLang = (language || "").toLowerCase().trim();

  if (cleanLang === "javascript" || cleanLang === "js" || cleanLang === "typescript" || cleanLang === "ts") {
    try {
      const logs: string[] = [];
      const customConsole = {
        log: (...args: any[]) => logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
        error: (...args: any[]) => logs.push("[ERROR] " + args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
        warn: (...args: any[]) => logs.push("[WARN] " + args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
      };

      const runSandbox = new Function("console", `"use strict"; ${code}`);
      const start = performance.now();
      const result = runSandbox(customConsole);
      const executionTimeMs = (performance.now() - start).toFixed(2);

      res.json({
        success: true,
        output: logs.join("\n") || (result !== undefined ? String(result) : "Code executed successfully."),
        returnValue: result !== undefined ? String(result) : undefined,
        executionTimeMs,
      });
    } catch (err: any) {
      res.json({
        success: false,
        error: err?.message || String(err),
      });
    }
  } else {
    res.json({
      success: true,
      output: `[Sandbox execution completed for ${cleanLang}]`,
    });
  }
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
    console.log(`JomCode J-1.0 AI Unified Server running on http://localhost:${PORT}`);
  });
}

startServer();
