const express = require("express");
const router = express.Router();
const { generateListings } = require("../controllers/generateListingsController");

router.get("/", generateListings);

module.exports = router;