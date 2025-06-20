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

const prompt = `Generate a MongoDB query filter (not projection) that can be passed into collection.find(<query>) to retrieve full documents.

Input:
- A user's search phrase (e.g., "antique chair under $300").

Instructions:
- Match the 'title' field by splitting the input into words (excluding price-related words), and create a case-insensitive regex for each word. Combine them with $and.
  Example: "comic book" ➜ { "$and": [ { "title": { "$regex": "comic", "$options": "i" } }, { "title": { "$regex": "book", "$options": "i" } } ] }

- Match the 'price' field based on common language patterns:
  - "under $300" ➜ { "price": { "$lte": 300 } }
  - "over $100" ➜ { "price": { "$gte": 100 } }
  - "between $50 and $150" ➜ { "price": { "$gte": 50, "$lte": 150 } }

- Return a single JSON object, with no extra text or code blocks.
- All regular expressions must use "$regex": "word", not /word/.
- Only output a parsable JSON object starting with '{'.
`;
const result = await genAI.models.generateContent({
  model: "gemini-1.5-pro",
  contents: prompt,
  config: {
    temperature: 0.7,
    // pass your text prompt here:
    text: prompt + '\nInput: "' + searchPrompt + '"',
  },
});

      const text = result.candidates[0].content.parts[0].text.trim();

      return text
      .replace(/```(json|js)?/g, "")
      .replace(/```/g, "")
      .trim();
  }

})


//? ~ Teancum ~





//? ~ Afton ~





//* ~ Start the server. ~
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});