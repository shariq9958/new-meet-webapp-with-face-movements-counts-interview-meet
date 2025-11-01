import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import App from './App.jsx';
// import JoinPage from './JoinPage.jsx'; // Will be replaced
import CreateMeetingPage from './pages/CreateMeetingPage.jsx';
import JoinMeetingPage from './pages/JoinMeetingPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import Navbar from './components/Navbar.jsx';
import './index.css'; // Global styles, ensure it's minimal or reset-focused
import './App.css';   // Main application styles, including themes
// App.css is imported in App.jsx, JoinPage.css in JoinPage.jsx

// Protected route component
const ProtectedRoute = ({ element, path }) => {
  // Check if user is logged in (token exists in localStorage)
  const isLoggedIn = localStorage.getItem('userToken') !== null;
  
  if (!isLoggedIn) {
    // Redirect to login if not logged in, save the intended destination
    localStorage.setItem('redirectAfterLogin', path);
    return <Navigate to="/login" />;
  }
  
  // If logged in, render the requested component
  return element;
};

// Layout component for pages with navbar (not the landing page)
const NavbarLayout = () => {
  return (
    <div className="pre-meeting-layout"> {/* Wrapper for light theme styling */}
      <Navbar />
      <Outlet /> {/* This will render JoinMeetingPage or CreateMeetingPage */}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Landing page as root with no navbar */}
        <Route path="/" element={<HomePage />} />

        {/* Auth pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Pages with navbar */}
        <Route element={<NavbarLayout />}>
          <Route path="/join-meeting" element={
            <ProtectedRoute 
              element={<JoinMeetingPage />}
              path="/join-meeting"
            />
          } />
          <Route path="/create-meeting" element={
            <ProtectedRoute 
              element={<CreateMeetingPage />}
              path="/create-meeting"
            />
          } />
        </Route>

        {/* Meeting room with no navbar */}
        <Route path="/room/:roomId" element={
          <ProtectedRoute 
            element={<App />}
            path="/room/:roomId"
          />
        } /> {/* Meeting room - uses its own dark theme via App.css */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
