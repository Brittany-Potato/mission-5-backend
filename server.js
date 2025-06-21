//* ~ Imports, constants and installs. ~
const express = require("express");
const app = express();
const port = "3000";
const { MongoClient } = require("mongodb");
const dotenv = require('dotenv');
const { GoogleGenAI } = require("@google/genai");

require('dotenv').config();



const ai_api = process.env.AI_API;
const ai_url = process.env.AI_url;


//* ~ Middleware to parse JSON requests. ~
app.use(express.json());

//* ~ Simple GET endpoint. ~
app.get("/hello", (req, res) => {
  res.json({ message: "Hello from Node.js!" });
});

//* ~ Simple POST end point. ~
app.post("/echo", (req, res) => {
  res.json({
    message: "You sent this",
    data: req.body,
  });
});

//? ~ Brittany ~

app.post("/homepageSearch",  async(req, res) => {
  const searchText = req.body.search;
  if (!searchText) {
    return res.status(400).json({ error: "Search text is required" });
  }

  const client = new MongoClient("mongodb://localhost:27017");
  try {
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    const mongoQueryString = await queryToMongo(searchText);
    console.log("Generated MongoDB query string:", mongoQueryString);

    console.log("AI returned:", mongoQueryString);

    const query = JSON.parse(mongoQueryString);
    const docs = await collection.find(query).toArray();

    return res.json({
      count: docs.length,
      results: docs,
    });
  } catch (err) {
    console.error("Error processing search:", err.message);
  }

  async function queryToMongo(searchPrompt) {
    const genAI = new GoogleGenAI({ apiKey: ai_api });

const prompt = `You are an expert MongoDB query builder.

Your task is to generate a valid MongoDB filter (no projection, no sort) for the following data model:

MongoDB documents are stored in the "auctionData" collection. Each document has these fields:

- Title: string (e.g., "Antique Wooden Chair")
- Location: string (e.g., "London")
- Condition: string (e.g., "Good", "Fair", "New")
- Payment: string (e.g., "PayPal")
- Shipping: string (e.g., "Worldwide", "NZ only")
- Price: string, with a dollar sign (e.g., "$250")
- Clearance: string, either "True" or "False"

Instructions:

1. Analyze the user's natural language input and extract keywords related to any of the fields above.
2. For each keyword:
   - If it refers to a field (e.g., "PayPal" ➜ Payment), match that field using a case-insensitive "$regex".
   - Combine multiple conditions using "$and".

3. Price handling:
   - "under $300" ➜ match "Price" values where the numeric part is <= 300 using regex.
   - "over $100" ➜ match where numeric part is >= 100.
   - "between $50 and $150" ➜ match values in that range.
   - Since Price is a string like "$250", use regex to simulate number ranges.
   - Example: { "Price": { "$regex": "^\\$([1-9][0-9]{0,2})$", "$options": "i" } }

4. Clearance:
   - If the phrase includes "clearance", match { "Clearance": "True" }

5. Always return a valid, clean JSON object that can be passed directly into MongoDB's collection.find() as the filter.

6. Do not include markdown, code blocks, or any explanation — only return the JSON.

Example user input:
"antique chair under $300 in London with PayPal shipping"

Expected JSON output:
{
  "$and": [
    { "Title": { "$regex": "antique", "$options": "i" } },
    { "Title": { "$regex": "chair", "$options": "i" } },
    { "Location": { "$regex": "London", "$options": "i" } },
    { "Payment": { "$regex": "PayPal", "$options": "i" } },
    { "Shipping": { "$regex": "shipping", "$options": "i" } },
    { "Price": { "$regex": "^\\$([1-9][0-9]{0,2}|300)$", "$options": "i" } }
  ]
}

User input: "${searchPrompt}"`
const result = await genAI.models.generateContent({
  model: "gemini-1.5-pro",
  contents: prompt,
  config: {
    temperature: 0.7,
    // pass your text prompt here:
    text: prompt + '\nInput: "' + searchPrompt + '"',
  },
});

      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!text) {
        throw new Error("Ai response is undefined or empty");
      }


      const cleaned = text
      .replace(/```(json|js)?/g, "")
      .replace(/\\(?!["\\/bfrtu])/g, "\\\\")
      .trim();

      console.log(`Cleaned JSON string:`, cleaned);
      return cleaned;
  };

})


//? ~ Teancum ~





//? ~ Afton ~





//* ~ Start the server. ~
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});