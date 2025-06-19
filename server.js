// Imports, constants and installs.
const express = require("express");
const app = express();
const port = " ";

// Middleware to parse JSON requests.
app.use(express.json());

// Simple GET endpoint.
app.get("./hello", (req, res) => {
  res.json({ message: "Hello from Node.js!" });
});

// Simple POST end point.
app.post("./echo", (req, res) => {
  res.json({
    message: "You sent this",
    data: req.body,
  });
});

// Start the server.
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});
