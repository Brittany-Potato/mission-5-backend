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

const prompt = `
Generate a MongoDB query filter (not projection) for use in collection.find(<query>) to retrieve full documents.

Input:
- A user's search phrase (e.g., "antique chair under $300").

Database Notes:
- Titles are stored in the 'Title' field.
- Prices are stored in the 'Price' field as **strings**, e.g., "$250", not numbers.
- Use case-insensitive regex to match title words.
- For price filtering:
  - Extract the number from 'Price' string using regex in the MongoDB query.
  - Match prices using regex to simulate comparisons:
    - "under $300" ➜ Match strings like "$0" to "$299"
    - "over $100" ➜ Match strings like "$101" and above
    - "between $50 and $150" ➜ Match strings from "$50" to "$150"

Instructions:
- Use '$and' to combine multiple regex matches on 'Title'.
- For price matching, use '$regex' on the 'Price' field.
- Only return a valid JSON query filter, no markdown, no extra text.
- Your result must be parseable JSON starting with '{'.

Example:
"antique chair under $300" ➜
{
  "$and": [
    { "Title": { "$regex": "antique", "$options": "i" } },
    { "Title": { "$regex": "chair", "$options": "i" } },
    { "Price": { "$regex": "^\\$([12]?\\d{1,2})$", "$options": "i" } }
  ]
}
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