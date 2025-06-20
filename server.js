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

    const prompt = `Search the Mongo database for a MongoDB query object for a collection with fields: title, location, condition, payment, shipping, price, clearance. Use exact field names and correct casing.
    For string fields like 'title', split the uer's input text into individual words (split by spaces or punctuation). For each word, generate a case-insensitive regex query that matches titles containing the word anywhere
    Combine all these regex queries using $and, so all words must be present in the title, in any order.
    
    for example:
    Input: "comic book"
    Output:
    {
      $and: [
      {title: { $regex: /comic/i } },
      {title: { $regex: /book/i } }
      ]
    }
      For numeric fields like "price" parse phrases like "over $100" or "under $50" and generate appropriate range queries.
      ONLY output valid JSON data with no explanations, no additional text, and no code blocks. The output must be parsable JSON starting with '[' or'{'.
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