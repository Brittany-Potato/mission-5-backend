const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");

router.get("/", async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Missing search query" });
  }

  const client = new MongoClient("mongodb://localhost:27017");

  try {
    await client.connect();
    const collection = client.db("Phase_2").collection("auctionData");

    const results = await collection
      .find({ Title: { $regex: query, $options: "i" } })
      .limit(5)
      .toArray();

    res.json(results);
  } catch (err) {
    console.error("Search route error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    await client.close();
  }
});

module.exports = router;
