const User = require('../models/User');
const jwt = require('jsonwebtoken');

// JWT Secret key - should be moved to environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Login controller
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findByEmail(email);
    
    // If user not found or password doesn't match
    if (!user || !(await User.verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    // User authenticated, generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, userType: user.user_type },
      JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days
    );
    
    // Return user info (excluding password_hash) and token
    const { password_hash, ...userWithoutPassword } = user;
    
    res.status(200).json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred during login' 
    });
  }
};

// Signup controller
exports.signup = async (req, res) => {
  try {
    const { email, password, full_name, user_type } = req.body;
    
    // Validate input
    if (!email || !password || !full_name || !user_type) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required: email, password, full_name, user_type' 
      });
    }
    
    // Validate user type (must be student or company)
    if (user_type !== 'student' && user_type !== 'company') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user type. Must be "student" or "company"' 
      });
    }
    
    // Create user
    const newUser = await User.create({
      email,
      password,
      full_name,
      user_type
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.user_id, email: newUser.email, userType: newUser.user_type },
      JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days
    );
    
    res.status(201).json({
      success: true,
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Signup error:', error);
    
    // Handle specific errors
    if (error.statusCode === 409) {
      return res.status(409).json({ 
        success: false, 
        message: 'Email already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred during signup' 
    });
  }
};

// Get current user info
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user info from database
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while fetching user data' 
    });
  }
}; 