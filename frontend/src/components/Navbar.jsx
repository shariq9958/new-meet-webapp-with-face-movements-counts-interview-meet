import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css'; // We'll create this for styling

const Navbar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in on component mount and token changes
    const checkLoginStatus = () => {
      const token = localStorage.getItem('userToken');
      const userInfo = localStorage.getItem('userInfo');
      
      if (token) {
        setIsLoggedIn(true);
        if (userInfo) {
          try {
            const parsedUserInfo = JSON.parse(userInfo);
            setUserName(parsedUserInfo.full_name || parsedUserInfo.email || 'User');
          } catch (e) {
            setUserName('User');
          }
        }
      } else {
        setIsLoggedIn(false);
        setUserName('');
      }
    };

    checkLoginStatus();

    // Listen for storage events (in case another tab logs in/out)
    window.addEventListener('storage', checkLoginStatus);
    
    return () => {
      window.removeEventListener('storage', checkLoginStatus);
    };
  }, []);

  const handleLogout = () => {
    // Clear user data from local storage
    localStorage.removeItem('userToken');
    localStorage.removeItem('userInfo');
    
    // Update state
    setIsLoggedIn(false);
    setUserName('');
    
    // Navigate to home page
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="navbar-logo">InterviewMeet</Link>
      </div>
      
      <div className="navbar-content">
        {isLoggedIn ? (
          <>
            {/* Show these links only if logged in */}
            <ul className="navbar-links">
              <li>
                <Link to="/create-meeting" className="navbar-link">Create Meeting</Link>
              </li>
              <li>
                <Link to="/join-meeting" className="navbar-link">Join Meeting</Link>
              </li>
            </ul>
            
            {/* User section with logout button */}
            <div className="navbar-user">
              <span className="navbar-username">Hello, {userName}</span>
              <button onClick={handleLogout} className="navbar-logout">Logout</button>
            </div>
          </>
        ) : (
          /* Show auth links if not logged in */
          <div className="navbar-auth">
            <Link to="/login" className="navbar-auth-link login-link">Login</Link>
            <Link to="/signup" className="navbar-auth-link signup-link">Sign Up</Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar; 