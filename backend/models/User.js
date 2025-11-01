const db = require('../config/db');
const bcrypt = require('bcrypt');

class User {
  // Find user by email
  static async findByEmail(email) {
    const query = `
      SELECT 
        u.user_id, 
        u.email, 
        u.password_hash, 
        u.full_name, 
        u.user_type_id,
        ut.type_name as user_type
      FROM 
        users u
      JOIN 
        user_types ut ON u.user_type_id = ut.user_type_id
      WHERE 
        u.email = $1
    `;
    
    try {
      const result = await db.query(query, [email]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  // Find user by ID
  static async findById(userId) {
    const query = `
      SELECT 
        u.user_id, 
        u.email, 
        u.full_name, 
        u.user_type_id,
        ut.type_name as user_type
      FROM 
        users u
      JOIN 
        user_types ut ON u.user_type_id = ut.user_type_id
      WHERE 
        u.user_id = $1
    `;
    
    try {
      const result = await db.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Create new user
  static async create(userData) {
    const { email, password, full_name, user_type } = userData;
    
    // Get user_type_id from user_types table
    const userTypeQuery = 'SELECT user_type_id FROM user_types WHERE type_name = $1';
    const userTypeResult = await db.query(userTypeQuery, [user_type]);
    
    if (userTypeResult.rows.length === 0) {
      throw new Error(`Invalid user type: ${user_type}`);
    }
    
    const userTypeId = userTypeResult.rows[0].user_type_id;
    
    // Hash the password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Insert new user
    const insertQuery = `
      INSERT INTO users 
        (email, password_hash, full_name, user_type_id) 
      VALUES 
        ($1, $2, $3, $4) 
      RETURNING 
        user_id, email, full_name, user_type_id
    `;
    
    try {
      const result = await db.query(insertQuery, [
        email, 
        passwordHash, 
        full_name, 
        userTypeId
      ]);
      
      // Fetch user type name for the response
      const user = result.rows[0];
      const typeResult = await db.query(
        'SELECT type_name FROM user_types WHERE user_type_id = $1', 
        [user.user_type_id]
      );
      
      return {
        ...user,
        user_type: typeResult.rows[0].type_name
      };
    } catch (error) {
      // Check for duplicate email error
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        const customError = new Error('Email already exists');
        customError.statusCode = 409; // Conflict
        throw customError;
      }
      
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User; 