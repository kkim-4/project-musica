// MyMusicAppBackend/routes/users.js
const express = require('express');
const { getMongoDb } = require('../db');
const { authenticateToken } = require('../middleware/auth'); // Ensure this path is correct
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();
const saltRounds = 10; // For bcrypt hashing

// Ensure JWT_SECRET is accessed via process.env
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("CRITICAL ERROR: JWT_SECRET environment variable is not set!");
  // In production, you might want to throw an error here to prevent startup
  // For development/debugging, logging and continuing might be desired,
  // but be aware that JWT operations will fail if it's truly missing.
}

// POST /api/auth/register (keeping it here for completeness of auth.js)
router.post('/register', async (req, res) => {
  const { email, password, username } = req.body;
  if (!email || !password || !username) {
    console.log('Registration attempt: Missing email, username, or password.');
    return res.status(400).json({ message: 'Email, username, and password are required' });
  }

  try {
    const db = await getMongoDb(); // AWAIT the database connection
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ $or: [{ email: email }, { username: username }] });
    if (existingUser) {
      console.log('Registration attempt: Email or username already in use.');
      return res.status(409).json({ message: 'Email or username already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = {
      email,
      username,
      password_hash: hashedPassword,
      avatar_url: null,
      created_at: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    const user = {
      id: result.insertedId.toHexString(),
      email: newUser.email,
      username: newUser.username,
      avatar_url: newUser.avatar_url
    };

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    console.log('Registration successful for user:', email);
    res.status(201).json({ message: 'User registered successfully', user: user, token });

  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
        return res.status(409).json({ message: 'Email or username already in use' });
    }
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// GET /api/users/profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const db = await getMongoDb(); // AWAIT the database connection
    const usersCollection = db.collection('users');

    // req.user.id is set by authenticateToken middleware
    const user = await usersCollection.findOne({ _id: new ObjectId(req.user.id) });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return only public-safe information
    res.status(200).json({
        id: user._id.toHexString(),
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        created_at: user.created_at
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
});

// PUT /api/users/profile
router.put('/profile', authenticateToken, async (req, res) => {
  const { username, avatar_url } = req.body; // Allow partial updates

  try {
    const db = await getMongoDb(); // AWAIT the database connection
    const usersCollection = db.collection('users');

    const updateFields = {};
    if (username !== undefined) updateFields.username = username;
    if (avatar_url !== undefined) updateFields.avatar_url = avatar_url;

    if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ message: 'No fields provided for update.' });
    }

    // Find and update the user document
    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(req.user.id) }, // Query by authenticated user's ID
      { $set: updateFields }, // Set only provided fields
      { returnDocument: 'after' } // Return the updated document
    );

    const user = result.value;
    if (!user) {
      return res.status(404).json({ message: 'User not found or nothing to update' });
    }

    res.status(200).json({
        message: 'Profile updated successfully',
        user: {
            id: user._id.toHexString(),
            email: user.email,
            username: user.username,
            avatar_url: user.avatar_url
        }
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    // Handle specific MongoDB error for duplicate unique fields (like username)
    if (error.code === 11000) { // MongoDB duplicate key error code
      return res.status(409).json({ message: 'Username already taken or email already in use' });
    }
    res.status(500).json({ message: 'Server error during profile update' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    console.log('Login attempt: Missing email or password in request body.');
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const db = await getMongoDb(); // AWAIT the database connection
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: email });

    // --- NEW DIAGNOSTIC LOGS ---
    console.log('\n--- DIAGNOSTIC LOGS FOR LOGIN START ---');
    console.log(`Attempting login for email: "${email}"`);
    console.log(`User object found: ${!!user}`); // True if user object exists

    if (user) {
        console.log(`User.password_hash property exists: ${Object.prototype.hasOwnProperty.call(user, 'password_hash')}`);
        console.log(`Type of user.password_hash: ${typeof user.password_hash}`);
        if (typeof user.password_hash === 'string') {
            console.log(`Length of user.password_hash: ${user.password_hash.length}`);
            console.log(`user.password_hash starts with $2b$: ${user.password_hash.startsWith('$2b$')}`);
        } else {
             console.log(`user.password_hash value (if not string):`, user.password_hash);
        }
    } else {
        console.log('User not found in database.');
    }

    console.log(`Password (from req.body) exists: ${!!password}`); // True if password var exists
    console.log(`Type of password (from req.body): ${typeof password}`);
    if (typeof password === 'string') {
        console.log(`Length of password (from req.body): ${password.length}`);
        // DO NOT log the actual password in production environments!
        // For debugging, a partial log can be helpful:
        // console.log(`Password received (first 3 chars): "${password.substring(0, Math.min(password.length, 3))}..."`);
    } else {
        console.log(`Password received is NOT a string. Value:`, password);
    }
    console.log('--- DIAGNOSTIC LOGS FOR LOGIN END ---\n');


    // 1. Check if user exists at all
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' }); // User not found
    }

    // 2. Defensive check: Ensure password_hash exists and is a valid string
    if (!user.password_hash || typeof user.password_hash !== 'string') {
        console.error('Login error: User found but password_hash is missing or invalid for user:', email);
        // Respond with a generic "Invalid credentials" to prevent leaking info about missing hashes
        return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // 3. Compare the password using the confirmed valid hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash); // await is here!

    if (!passwordMatch) {
      console.log('Login attempt: Password mismatch for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' }); // Password mismatch
    }

    const userPayload = { id: user._id.toHexString(), email: user.email };
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' }); // Use JWT_SECRET

    console.log('Login successful for user:', email);
    res.status(200).json({
      message: 'Logged in successfully',
      user: {
        id: user._id.toHexString(),
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url
      },
      token
    });

  } catch (error) {
    console.error('Login route (outer catch) error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

module.exports = router;