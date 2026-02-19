// MyMusicAppBackend/middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT verification error:', err);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user; // Attach user payload to request (e.g., {id: user_id, email: user_email})
    next();
  });
};

function softAuthenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (token == null) {
        return next(); // No token, just proceed
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (!err) {
            req.user = user; // Token is valid, add user to the request
        }
        next(); // Proceed even if token is invalid
    });
}

module.exports = { authenticateToken, softAuthenticateToken };