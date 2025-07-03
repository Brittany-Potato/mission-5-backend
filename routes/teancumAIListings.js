const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");
const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const ai_api = process.env.AI_API;

router.post("/", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const genAI = new GoogleGenAI({ apiKey: ai_api });

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: {
        role: "user",
        parts: [
          {
            text: `Generate 50 auction listing objects for this prompt: "${prompt}". Each object must include: title, price, condition, feature (as array), description, dimension, weight, color, review, shipping, payment, brand. JSON only. No explanation.`,
          },
        ],
      },
    });

    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: "Empty AI response" });

    const cleaned = text.replace(/```(json)?/g, "").trim();
    const listings = JSON.parse(cleaned);

    const client = new MongoClient("mongodb://localhost:27017");
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    await collection.insertMany(listings);
    await client.close();

    res.json({ insertedCount: listings.length });
  } catch (error) {
    console.error("AI generation error:", error.message);
    res.status(500).json({ error: "AI listing generation failed" });
  }
});

module.exports = router;