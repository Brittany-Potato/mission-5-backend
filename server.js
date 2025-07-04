//* ~ Imports, constants and installs. ~
const express = require("express");
const app = express();
const port = "3000";
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require('dotenv');
const { GoogleGenAI } = require("@google/genai");
const cors = require('cors');

require('dotenv').config();



const ai_api = process.env.AI_API;
const ai_url = process.env.AI_url;


//* ~ Middleware to parse JSON requests. ~

app.use(cors());
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
      Title: { $regex: title, $options: "i" } // Match documents where "Title", contains the query string (case-insensitive)
    });

    res.json({ title, count});
  } catch (err) {
    console.error("Error counting items:", err.message);
  } finally {
    client.close();
  }
});


app.post("/homepageSearch", async (req, res) => {
  console.log("Search request received:", req.body);
  const searchText = req.body.search;
  if (!searchText) {
    return res.status(400).json({ error: "Search text is required" });
  }

  const client = new MongoClient("mongodb://localhost:27017");
  try {
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    if (typeof searchText !== 'string' || searchText.trim().length < 2) { // Skip AI call is search input is too short or invalid
      console.log("Invalid searchText, returning empty result");
      return res.json([]) // Checking if the user typed something useful or skipping the AI step
    }

    const mongoQueryString = await queryToMongo(searchText);
    console.log("Generated MongoDB query string:", mongoQueryString);

    console.log("AI returned:", mongoQueryString);

    const query = JSON.parse(mongoQueryString); // Convert he AI-generated string into a mongodb query object
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

3. IMPORTANT Price handling:
  - "over $200" ➜ match "Price" values where the numeric part is >= 200 using regex.
  - "between $50 and $100" ➜ match values in that range.
  - "between $100 and $200" ➜ match values in that range, For $100–$200, use:
      { "Price": { "$regex": "^\\$(1[0-9]{2}|200)$", "$options": "i" } }

  - "between $0 and $50" ➜ match values in that range.
  - Since Price is a string like "$250", use regex to simulate number ranges.
  - Example: { "Price": { "$regex": "^\\$([1-9][0-9]{0,2})$", "$options": "i" } }

4. Clearance:
   - If the phrase includes "clearance", match { "Clearance": "True" } or  { "Clearance": "false" } depending on what the mongodb says the clearance is.

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
    { "Price": { "$regex": "^\\$(1[0-9]{2}|200)$", "$options": "i" } }
  ]
}
  The regular expressions you're generating (e.g., ^\$([5-9][0-9]|100)$) are correct in terms of logic, but invalid JSON strings due to unescaped backslashes.

  This is a correct response as an example: {
  "$and": [
    {
      "Price": {
        "$regex": "^\\$([5-9][0-9]|100)$",  // Match $100–$200 <-- NO EXTRA BACKSLASHES PLEASE
        "$options": "i"
      }
    }
  ]
}
Do NOT use too many backslashes like in this example: "Price": {"$regex": "^\\\$([1-9][0-9]{2}|[1-1][0-9]{2}|200)$", "$options": "i"}

Do NOT repeat the mistake of overlapping or incorrect ranges like: [1-9][0-9]{2}|[1-1][0-9]{2}|200 .

Escape your backslashes where necessary.

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
      throw new Error("Ai response is undefined or empty"); // Check for empty AI response before attempting to parse
    }

    // console.log("Generated MongoDB query string:", mongoQueryString);


    const cleaned = text
      .replace(/```(json|js)?/g, "")
      .replace(/\\(?!["\\/bfrtu])/g, "\\\\")
      .trim(); // Clean up AI response: remove markdown/code blocks and fix backslash escaping

    console.log(`Cleaned JSON string:`, cleaned);

    const mongoQuery = JSON.parse(cleaned);
    console.log("MongoDB query:", mongoQuery);

    const collection = client.db("Phase_2").collection("auctionData");

    const results = await collection.find(mongoQuery).toArray();
    return res.json(results);
  };
})

app.get("/randomProducts", async (req, res) => {
  const client = new MongoClient("mongodb://localhost:27017");
  try {
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    //Return 10 random products
    const products = await collection.aggregate([
      { $sample: { size: 10} }
    ]).toArray();

    res.json(products);
  } catch (err) {
    console.error("Failed to fetch products:", err.message);
    res.status(500).json({ error: "Failed to fetch products"});
  } finally {
    await client.close();
  } // Return 10 Random products using Mongo's $sample aggregation
});


//? ~ Teancum ~


app.get("/teancumRandomProducts", async (req, res) => {
  const client = new MongoClient("mongodb://localhost:27017");
  try {
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    const randomItems = await collection.aggregate([{ $sample: { size: 5 } }]).toArray();

    res.json({ results: randomItems });
  } catch (err) {
    console.error("Error fetching random products:", err.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    await client.close();
  }
});


app.post("/teancumSearch", async (req, res) => {
  const { search } = req.body;


  if (!search || typeof search !== "string" || search.trim().length < 2) {
    return res.json({ results: [] });
  }

  const client = new MongoClient("mongodb://localhost:27017");
  try {
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    const query = {
      $or: [
        { title: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ]
    };

    const results = await collection.find(query).limit(5).toArray();
    res.json({ results });
  } catch (err) {
    console.error("Teancum Search Error:", err.message);
    res.status(500).json({ error: "Internal error" });
  } finally {
    await client.close();
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