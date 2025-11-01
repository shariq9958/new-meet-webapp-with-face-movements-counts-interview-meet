const jwt = require('jsonwebtoken');

// JWT Secret key - should be moved to environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to check if the user is authenticated
const authenticateJwt = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authorization token is missing' 
    });
  }
  
  // Extract token (remove "Bearer " prefix)
  const token = authHeader.split(' ')[1];
  
  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Add user data to request object
    req.user = decoded;
    
    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token has expired' 
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid authentication token' 
    });
  }
};

module.exports = { authenticateJwt }; 