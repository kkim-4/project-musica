const express = require('express');
const { getMongoDb } = require('../db');
// Correctly import the middleware using destructuring
const { authenticateToken } = require('../middleware/auth');
const { ObjectId } = require('mongodb');

const router = express.Router();

// This route should only use the strict authenticateToken
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const db = await getMongoDb();
    const usersCollection = db.collection('users');
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
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  const { username, avatar_url } = req.body;
  try {
    const db = await getMongoDb();
    const usersCollection = db.collection('users');

    const updateFields = {};
    if (username !== undefined) updateFields.username = username;
    if (avatar_url !== undefined) updateFields.avatar_url = avatar_url;

    if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ message: 'No fields to update.' });
    }

    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(req.user.id) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );
    
    const user = result.value;
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ 
        message: 'Profile updated successfully', 
        user: { id: user._id.toHexString(), email: user.email, username: user.username, avatar_url: user.avatar_url } 
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Username already taken' });
    }
    res.status(500).json({ message: 'Server error during profile update' });
  }
});

module.exports = router;