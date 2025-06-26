// models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: String,
  images: [String],
  price: Number,
  bidStartPrice: Number,
  bids: [
    {
      user: String,
      amount: Number,
    },
  ],
  description: String,
  details: String,
  seller: {
    name: String,
    location: String,
    memberSince: Date,
    rating: Number,
  },
  shippingOptions: [String],
  paymentOptions: [String],
  category: String,
});

module.exports = mongoose.model("Product", productSchema);
