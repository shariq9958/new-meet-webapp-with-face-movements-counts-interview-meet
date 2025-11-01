import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';

const SignupPage = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState('student'); // Default to student
  const [terms, setTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('userToken');
    if (token) {
      // Redirect to the home page or wherever appropriate
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    // Basic validation
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match!');
      return;
    }
    
    if (!terms) {
      setErrorMessage('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Call backend API to register user
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          user_type: userType // 'student' or 'company'
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Store the token
        localStorage.setItem('userToken', data.token);
        
        // Store user info for display
        localStorage.setItem('userInfo', JSON.stringify(data.user));
        
        // Check if there's a redirect path
        const redirectPath = localStorage.getItem('redirectAfterLogin') || '/';
        localStorage.removeItem('redirectAfterLogin'); // Clear the redirect path
        
        // Redirect the user
        navigate(redirectPath);
      } else {
        // Handle error from server
        setErrorMessage(data.message || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setErrorMessage('An error occurred during signup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-header">
            <Link to="/" className="auth-logo">
              <span>InterviewMeet</span>
            </Link>
            <h1>Create Your Account</h1>
            <p>Join us to streamline your interviews!</p>
          </div>

          {errorMessage && (
            <div className="auth-error">
              {errorMessage}
            </div>
          )}

          <div className="auth-divider">
            <span>Or continue with email</span>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input 
                type="text" 
                id="fullName" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required 
                placeholder="John Doe" 
                disabled={isLoading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input 
                type="email" 
                id="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                placeholder="you@example.com" 
                disabled={isLoading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="userType">I am a:</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="userType"
                    value="student"
                    checked={userType === 'student'}
                    onChange={() => setUserType('student')}
                    disabled={isLoading}
                  />
                  Student
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="userType"
                    value="company"
                    checked={userType === 'company'}
                    onChange={() => setUserType('company')}
                    disabled={isLoading}
                  />
                  Company/Recruiter
                </label>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input 
                type="password" 
                id="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                placeholder="••••••••" 
                disabled={isLoading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input 
                type="password" 
                id="confirmPassword" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
                placeholder="••••••••" 
                disabled={isLoading}
              />
            </div>

            <div className="form-terms-group">
              <input 
                type="checkbox" 
                id="terms" 
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                required
                disabled={isLoading}
              />
              <div className="terms-text">
                <label htmlFor="terms">I agree to the
                  <Link to="/terms" className="terms-link">Terms of Service</Link> and 
                  <Link to="/privacy" className="terms-link">Privacy Policy</Link>.
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-button"
              disabled={isLoading}
            >
              {isLoading
                ? 'Processing...'
                : userType === 'student'
                ? 'Pay ₹99 & Create Account'
                : 'Proceed to Plans & Create Account'}
            </button>
          </form>

          <p className="auth-alt-action">
            Already have an account? 
            <Link to="/login" className="auth-alt-link">
              Log in
            </Link>
          </p>
        </div>
      </main>

      <footer className="auth-footer">
        <p>&copy; {new Date().getFullYear()} InterviewMeet. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default SignupPage; 