const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const router = express.Router();

// Register endpoint
router.post("/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const isEmailUnique = await checkEmailUniqueness(email); // Ensure this function exists and works correctly
    if (!isEmailUnique) {
      return res.status(400).json({ error: "Email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { insertId } = await req.db.query(
      `INSERT INTO users (email, password, firstName, lastName) VALUES (:email, :hashedPassword, :firstName, :lastName)`,
      {email, hashedPassword, firstName, lastName}
    );

    const jwtEncodedUser = jwt.sign(
      { userId: insertId, email, firstName, lastName },
      process.env.JWT_KEY
    );

    res.json({ jwt: jwtEncodedUser, success: true });
  } catch (err) {
    console.error("Error in /register:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login endpoint
router.post("/log-in", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const [[user]] = await req.db.query(
      `SELECT * FROM users WHERE email = :email`,
      {email}
    );

    if (!user) {
      return res.status(404).json({ error: "Email not found", success: false });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (passwordMatches) {
      const payload = {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      };
      const jwtEncodedUser = jwt.sign(payload, process.env.JWT_KEY);
      return res.json({ jwt: jwtEncodedUser, success: true });
    } else {
      return res.status(401).json({ error: "Password is incorrect", success: false });
    }
  } catch (err) {
    console.error("Error in /log-in:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
