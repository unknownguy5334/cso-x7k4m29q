import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Initialize Gemini client lazily/safely
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
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
  };

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "Register Course Scheduler" });
  });

  // Schedule extraction from image (OCR Vision), multiple images, or raw text via Gemini
  app.post("/api/extract-schedule", async (req, res) => {
    try {
      const { image, images, mimeType, text } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        return res.status(503).json({
          error: "GEMINI_API_KEY is not configured on the server. Please use text paste or manual entry.",
        });
      }

      const prompt = `You are a high-precision university course schedule extractor.
Extract every course section visible in this schedule image or text.
For each section, extract:
- name: The full course name / title (e.g. "Business Ethics", "Accounting Information Systems", "Calculus I")
- id: The specific section code or unique identifier (e.g. "BUS302-New02", "ACT33101", "CS101-01"). If no section code exists, create one from course abbreviation + section number.
- credits: credit hours as an integer or float number (e.g. 3 or 4). If not explicitly visible or uncertain, set to null (DO NOT guess or invent numbers).
- instructor: instructor / professor name if visible, otherwise null
- sessions: array of every meeting session. Lecture, discussion/lab, and tutorial sessions must all be separate session entries.
  - day: MUST BE exactly one of "SAT", "SUN", "MON", "TUE", "WED", "THU", "FRI"
  - start: 24-hour time format "HH:MM" (e.g. "08:30", "13:00", "14:30")
  - end: 24-hour time format "HH:MM" (e.g. "10:00", "14:30", "16:00")

Normalize any AM/PM times into 24-hour HH:MM format (e.g. 1:00 PM -> 13:00, 2:30 PM -> 14:30).
Detect if multiple sections are identical in day/times but differ by instructor, and preserve the instructor field.
Return ONLY structured data matching the schema.`;

      const imageList: Array<{ data: string; mimeType: string }> = [];

      if (Array.isArray(images) && images.length > 0) {
        for (const imgItem of images) {
          const raw = typeof imgItem === "string" ? imgItem : imgItem.data;
          const mime = (typeof imgItem === "object" && imgItem.mimeType) || "image/jpeg";
          const clean = raw.includes(",") ? raw.split(",")[1] : raw;
          imageList.push({ data: clean, mimeType: mime });
        }
      } else if (image) {
        const cleanBase64 = image.includes(",") ? image.split(",")[1] : image;
        const validMime = mimeType || "image/jpeg";
        imageList.push({ data: cleanBase64, mimeType: validMime });
      }

      let contents: any;

      if (imageList.length > 0) {
        const parts: any[] = imageList.map((img) => ({
          inlineData: {
            data: img.data,
            mimeType: img.mimeType,
          },
        }));
        parts.push({ text: prompt });
        contents = { parts };
      } else if (text) {
        contents = {
          parts: [
            {
              text: `${prompt}\n\nHere is the raw text to extract courses from:\n\n${text}`,
            },
          ],
        };
      } else {
        return res.status(400).json({ error: "Missing image or text payload" });
      }

      const modelsToTry = [
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.7-flash",
        "gemini-flash-latest",
      ];

      let lastError: any = null;
      let parsedData: any = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  sections: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING, description: "Section code or identifier" },
                        name: { type: Type.STRING, description: "Course title / subject" },
                        credits: { type: Type.NUMBER, description: "Credit hours or null if unknown" },
                        instructor: { type: Type.STRING, description: "Instructor name if available" },
                        sessions: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              day: {
                                type: Type.STRING,
                                description: "SAT, SUN, MON, TUE, WED, THU, or FRI",
                              },
                              start: { type: Type.STRING, description: "HH:MM start time (24h)" },
                              end: { type: Type.STRING, description: "HH:MM end time (24h)" },
                            },
                            required: ["day", "start", "end"],
                          },
                        },
                      },
                      required: ["id", "name", "sessions"],
                    },
                  },
                },
                required: ["sections"],
              },
            },
          });

          const responseText = response.text || "{}";
          parsedData = JSON.parse(responseText);
          if (parsedData?.sections) {
            break;
          }
        } catch (modelErr: any) {
          console.warn(`Extraction attempt with ${modelName} failed, trying fallback:`, modelErr?.message || modelErr);
          lastError = modelErr;
        }
      }

      if (!parsedData || !parsedData.sections) {
        throw lastError || new Error("All extraction models experienced high demand. Please try again in a moment.");
      }

      return res.json({
        success: true,
        sections: parsedData.sections || [],
      });
    } catch (err: any) {
      console.error("Error in /api/extract-schedule:", err);
      let errorMsg = err?.message || "Failed to extract schedule data from provided source.";
      try {
        if (typeof errorMsg === "string" && errorMsg.trim().startsWith("{")) {
          const parsed = JSON.parse(errorMsg);
          if (parsed?.error?.message) {
            errorMsg = parsed.error.message;
          }
        }
      } catch {
        // keep original errorMsg
      }
      return res.status(500).json({
        error: errorMsg,
      });
    }
  });

  // Vite middleware for development vs static serving in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Register Course Scheduler running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
