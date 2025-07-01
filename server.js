//* ~ Imports, constants and installs. ~
const express = require("express");
const app = express();
const port = "3000";
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require('dotenv');
const { GoogleGenAI } = require("@google/genai");
const cors = require('cors');
const teancumAIListings = require("./routes/teancumAIListings");

require('dotenv').config();



const ai_api = process.env.AI_API;
const ai_url = process.env.AI_url;


//* ~ Middleware to parse JSON requests. ~

app.use(cors());
app.use(express.json());
app.use("/teancumAIListings", teancumAIListings);

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

app.post("/countItems", async (req, res) => {
  const { title } = req.body; 

  if (!title) {
    return res.status(400).json({ error: "Title query parameter is required"});
  }

  const client = new MongoClient("mongodb://localhost:27017");
  try {
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    const count = await collection.countDocuments({ // Counts all the documents that match what the user typed
      Title: { $regex: title, $options: "i" } // Match case-insensitive
    });

    res.json({ title, count});
  } catch (err) {
    console.error("Error counting items:", err.message);
  } finally {
    client.close();
  }
});


app.post("/homepageSearch", async (req, res) => {
  console.log("📨 Search request received:", req.body);
  const searchText = req.body.search;

  if (!searchText) {
    return res.status(400).json({ error: "Search text is required" });
  }

  const client = new MongoClient("mongodb://localhost:27017");
  try {
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    if (typeof searchText !== 'string' || searchText.trim().length < 2) {
      console.log("⚠️ Invalid search input, returning empty array");
      return res.json([]); // skip if input is too short
    }

    const mongoQuery = await queryToMongo(searchText);
    console.log("🧠 AI generated MongoDB query:", mongoQuery);

    const results = await collection.find(mongoQuery).limit(5).toArray();
    return res.json({
      count: results.length,
      results: results,
    });
  } catch (err) {
    console.error("❌ Error processing search:", err.message);
    return res.status(500).json({ error: "Search processing failed" });
  } finally {
    await client.close();
  }
});

  async function queryToMongo(searchPrompt) {
    const genAI = new GoogleGenAI({ apiKey: ai_api });

const prompt = `You are an expert MongoDB query builder.

Your task is to generate a valid MongoDB filter (no projection, no sort) for the following data model:

MongoDB documents are stored in the "auctionData" collection. Each document has these fields:

- title: string (e.g., "Antique Wooden Chair")
- location: string (e.g., "London")
- condition: string (e.g., "Good", "Fair", "New")
- payment: string (e.g., "PayPal")
- shipping: string (e.g., "Worldwide", "NZ only")
- price: number (e.g., 250)
- clearance: string, either "True" or "False"

Instructions:

1. Analyze the user's natural language input and extract keywords related to any of the fields above.
2. For each keyword:
   - If it refers to a field (e.g., "PayPal" ➜ payment), match that field using a case-insensitive "$regex".
   - Combine multiple conditions using "$and".

3. Price handling:
  - If the user says "under $300", generate: { "price": { "$lt": 300 } }
  - If they say "over $500", use: { "price": { "$gte": 500 } }
  - If they say "between $100 and $200", use: { "price": { "$gte": 100, "$lte": 200 } }

4. Clearance:
   - If the phrase includes "clearance", match: { "clearance": "True" }

5. Only return a clean JSON object that can be used directly as a MongoDB filter in collection.find().

6. Do NOT include markdown, code blocks, or explanation — just the JSON object.

Example user input:
"antique chair under $300 in London with PayPal shipping"

Expected JSON output:
{
  "$and": [
    { "title": { "$regex": "antique", "$options": "i" } },
    { "title": { "$regex": "chair", "$options": "i" } },
    { "location": { "$regex": "London", "$options": "i" } },
    { "payment": { "$regex": "PayPal", "$options": "i" } },
    { "shipping": { "$regex": "shipping", "$options": "i" } },
    { "price": { "$lt": 300 } }
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

    // console.log("Generated MongoDB query string:", mongoQueryString);


    const cleaned = text
      .replace(/```(json|js)?/g, "")
      .replace(/\\(?!["\\/bfrtu])/g, "\\\\")
      .trim();

    console.log(`Cleaned JSON string:`, cleaned);

    const mongoQuery = JSON.parse(cleaned);
    console.log("MongoDB query:", mongoQuery);

    return mongoQuery;
  };


//? ~ Teancum ~

app.get("/generateListings", async (req, res) => {
  const client = new MongoClient("mongodb://localhost:27017");
  try {
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    const listings = await collection.find().limit(10).toArray();
    res.json({ listings });
  } catch (err) {
    console.error("Error fetching listings:", err.message);
    res.status(500).json({ error: "Failed to fetch listings" });
  } finally {
    await client.close();
  }
});

app.post("/generateListings", async (req, res) => {
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
            text: `Generate 2 auction listing objects for this prompt: "${prompt}". Include fields: title, price, condition, feature (as an array of strings), description, dimension, weight, color, review, shipping, payment, brand. Respond in JSON only, with no explanation.`,
          },
        ],
      },
    });

    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: "Empty AI response" });

    const cleaned = text
      .replace(/```(json)?/g, "")
      .replace(/^\s*\n/gm, "")
      .trim();

    const listings = JSON.parse(cleaned);
    const client = new MongoClient("mongodb://localhost:27017");
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    await collection.insertMany(listings);

    await client.close();

    res.json(listings);
  } catch (error) {
    console.error("Error generating listings:", error.message);
    res.status(500).json({ error: "Failed to generate listings" });
  }
});

//? ~ Afton ~

// Endpoint to fetch a product by ID
// This endpoint retrieves a product by its ID from the MongoDB database.
app.get("/product/:id", async (req, res) => {
  const productId = req.params.id;

  // Use ObjectId.isValid for validation
  if (!ObjectId.isValid(productId)) {
    return res.status(400).json({ error: "Invalid product ID format" });
  }

  const client = new MongoClient("mongodb://localhost:27017");
  try {
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    // Use new ObjectId(productId) for the query
    const product = await collection.findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    await client.close();
  }
});

// Endpoint to fetch similar products based on the current product's title and location
// This endpoint retrieves similar products based on the first word of the current product's title and its
app.get("/product/:id/similar", async (req, res) => {
  const productId = req.params.id;
  const client = new MongoClient("mongodb://localhost:27017");

  try {
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    // Use new ObjectId(productId) for the query
    const currentproduct = await collection.findOne({ _id: new ObjectId(productId) });
    if (!currentproduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    const keyword = currentproduct.Title.split(" ")[0]; // Use the first word of the title as a keyword
    
    const similarProducts = await collection.find({
      Title: { $regex: keyword, $options: "i" }, // Case-insensitive search
      _id: { $ne: new ObjectId(productId) }, // Exclude the current product
      $or: [
        { Location: currentproduct.Location },
      ] 
    })
    .limit(4) // Limit to 4 similar products
    .toArray();

    res.json(similarProducts);
  } catch (err) {
    console.error("Error fetching similar products:", err.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    await client.close();
  }
});

//* ~ Start the server. ~
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});