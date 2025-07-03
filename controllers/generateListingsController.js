const { GoogleGenerativeAI } = require("@google/generative-ai");
const { MongoClient } = require("mongodb");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateListings = async (req, res) => {
  try {
    const prompt = "Generate 3 auction listings in JSON format. Each listing must include: title, description, price, condition, brand, shipping info, and payment method.";

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Try parsing the text as JSON
    let listings;
    try {
      listings = JSON.parse(text);
    } catch (error) {
      return res.status(500).json({ error: "AI response was not valid JSON", raw: text });
    }

    // Connect to DB
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db("Phase_2");
    const collection = db.collection("auctionData");

    // Insert listings
    await collection.insertMany(listings);

    res.json({ listings });
  } catch (err) {
    console.error("Error generating listings:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { generateListings };
