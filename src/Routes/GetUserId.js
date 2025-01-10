const jwt = require('jsonwebtoken');

function getUserIdFromToken(refreshToken) {
    try {
      const decoded = jwt.decode(refreshToken);
      return decoded.id; // Extracts userId from the token's id field
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }
  
  module.exports = getUserIdFromToken;
