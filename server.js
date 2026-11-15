
import express from "express";

const app = express();

app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

// Identitas dan instruksi NINA
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
`;

// Pemeriksaan server
app.get("/", (req, res) => {
  res.json({
    name: "NINA AI Backend",
    status: "online",
    version: "1.0.0"
  });
});

// Pemeriksaan kesehatan server
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    ai: API_KEY ? "configured" : "not configured"
  });
});

// Endpoint percakapan NINA
app.post("/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        error: "OpenAI API belum dikonfigurasi."
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
      return res.status(413).json({
        error: "Pesan terlalu panjang."
      });
    }

    // Batasi riwayat percakapan
    const safeHistory = Array.isArray(history)
      ? history.slice(-12)
          .filter(item =>
            item &&
            ["user", "assistant"].includes(item.role) &&
            typeof item.content === "string"
          )
          .map(item => ({
            role: item.role,
            content: item.content.slice(0, 10000)
          }))
      : [];

    const input = [
      ...safeHistory,
      {
        role: "user",
        content: message.trim()
      }
    ];

    // Hubungkan ke OpenAI Responses API
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          instructions: NINA_INSTRUCTIONS,
          input,
          max_output_tokens: 1200
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "OpenAI error:",
        response.status
      );

      return res.status(502).json({
        error: "AI sedang mengalami gangguan."
      });
    }

    // Ambil jawaban AI
    const reply = (data.output || [])
      .filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "AI tidak menghasilkan jawaban."
      });
    }

    return res.json({
      reply: reply,
      source: "ONLINE AI",
      model: MODEL
    });

  } catch (error) {
    console.error("Server error:", error.message);

    return res.status(500).json({
      error: "Terjadi kesalahan pada server NINA."
    });
  }
});

// Jalankan server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`NINA backend berjalan di port ${PORT}`);
});
