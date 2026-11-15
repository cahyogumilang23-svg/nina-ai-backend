
import express from "express";

const app = express();

app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.8-flash";

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const NINA_INSTRUCTIONS = `
Kamu adalah NINA, personal AI assistant.

Karakter:
- Ramah, cerdas, dan sopan.
- Berkomunikasi menggunakan Bahasa Indonesia.
- Jawab pertanyaan dengan jelas dan akurat.
- Bantu pengguna dalam aktivitas sehari-hari.
- Ingat konteks percakapan yang diberikan.
- Jangan mengarang informasi.
- Jika tidak mengetahui sesuatu, katakan dengan jujur.
- Berikan jawaban yang mudah dipahami.
`;

// Pemeriksaan server
app.get("/", (req, res) => {
  res.json({
    name: "NINA AI Backend",
    status: "online",
    version: "2.0.0",
    engine: "Google Gemini"
  });
});

// Pemeriksaan kesehatan
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    ai: GEMINI_API_KEY ? "configured" : "not configured",
    model: GEMINI_MODEL
  });
});

// Endpoint percakapan NINA
app.post("/chat", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(503).json({
        error: "Gemini API belum dikonfigurasi."
      });
    }

    const { message, history = [] } = req.body;

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "Pesan tidak boleh kosong."
      });
    }

    if (message.length > 10000) {
      return res.status(400).json({
        error: "Pesan terlalu panjang."
      });
    }

    // Batasi jumlah riwayat percakapan
    const safeHistory = Array.isArray(history)
      ? history.slice(-12)
      : [];

    const contents = [];

    for (const item of safeHistory) {
  if (!item) continue;

  const text = item.content ?? item.text;

  if (
    typeof text !== "string" ||
    !text.trim()
  ) {
    continue;
  }

  if (
    text.length > 10000 ||
    (item.role !== "user" &&
     item.role !== "assistant")
  ) {
    continue;
  }

  contents.push({
    role: item.role === "assistant"
      ? "model"
      : "user",
    parts: [{ text }]
  });
    }

    // Hindari mengirim pesan terakhir dua kali
    const lastItem = contents[contents.length - 1];

    if (
      !lastItem ||
      lastItem.role !== "user" ||
      lastItem.parts[0].text.trim() !== message.trim()
    ) {
      contents.push({
        role: "user",
        parts: [{ text: message.trim() }]
      });
    }

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            { text: NINA_INSTRUCTIONS }
          ]
        },
        contents,
        generationConfig: {
  maxOutputTokens: 2048
        }
      }),
      signal: AbortSignal.timeout(60000)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        response.status,
        data.error?.message || "Unknown error"
      );

      return res.status(502).json({
        error: "Gemini sedang mengalami gangguan.",
        code: response.status
      });
    }

    const reply = (
      data.candidates?.[0]?.content?.parts || []
    )
      .filter(part => typeof part.text === "string")
      .map(part => part.text)
      .join("\n")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini tidak menghasilkan jawaban."
      });
    }

    return res.json({
      reply,
      source: "ONLINE AI",
      model: GEMINI_MODEL
    });

  } catch (error) {
    console.error(
      "NINA server error:",
      error.message
    );

    return res.status(500).json({
      error: "Terjadi kesalahan pada server NINA."
    });
  }
});

// Jalankan server
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `NINA backend berjalan di port ${PORT}`
  );
});
