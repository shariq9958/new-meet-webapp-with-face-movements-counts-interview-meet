import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../App.css';

const HomePage = () => {
  // Add toggle functionality when component mounts
  useEffect(() => {
    const pricingToggle = document.getElementById('pricing-toggle');
    if (pricingToggle) {
      // Initially ensure the correct display is set
      const studentPricing = document.querySelector('.pricing-cards.student-pricing');
      const companyPricing = document.querySelector('.pricing-cards.company-pricing');
      
      // Set initial display
      if (studentPricing && companyPricing) {
        studentPricing.style.display = 'flex';
        companyPricing.style.display = 'none';
      }
      
      // Add event listener for toggle changes
      pricingToggle.addEventListener('change', (e) => {
        if (studentPricing && companyPricing) {
          if (e.target.checked) {
            // Company pricing
            studentPricing.style.display = 'none';
            companyPricing.style.display = 'flex';
          } else {
            // Student pricing
            studentPricing.style.display = 'flex';
            companyPricing.style.display = 'none';
          }
        }
      });
    }
  }, []);

  // Function to handle navigation with auth check
  const handleAuthNavigation = (path) => {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('userToken') !== null;
    
    if (!isLoggedIn) {
      // If not logged in, store the intended destination and redirect to login
      localStorage.setItem('redirectAfterLogin', path);
      window.location.href = '/login';
    } else {
      // If logged in, navigate directly to the destination
      window.location.href = path;
    }
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1>InterviewMeet</h1>
          <p>The most efficient way to conduct and practice interviews</p>
          <div className="hero-buttons">
            <button 
              onClick={() => handleAuthNavigation('/create-meeting')}
              className="hero-button create-button"
            >
              Create Meeting
            </button>
            <button 
              onClick={() => handleAuthNavigation('/join-meeting')}
              className="hero-button join-button"
            >
              Join Meeting
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <h2>Why Choose InterviewMeet?</h2>
        
        <div className="feature-grid">
          {/* For Students */}
          <div className="feature-category">
            <h3>For Students</h3>
            <div className="feature-items">
              <div className="feature-item">
                <div className="feature-icon student-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
                </div>
                <h4>AI-Powered Feedback</h4>
                <p>Get instant feedback on your eye contact, engagement, and clarity during practice interviews</p>
              </div>

              <div className="feature-item">
                <div className="feature-icon student-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                  </svg>
                </div>
                <h4>Unlimited Practice</h4>
                <p>Practice interviews as many times as you need to build confidence and perfect your answers</p>
              </div>
            </div>
          </div>

          {/* For Companies */}
          <div className="feature-category">
            <h3>For Companies</h3>
            <div className="feature-items">
              <div className="feature-item">
                <div className="feature-icon company-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <h4>Advanced Analysis</h4>
                <p>Get objective insights on candidate engagement, communication style, and key competencies</p>
              </div>

              <div className="feature-item">
                <div className="feature-icon company-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                </div>
                <h4>Efficient Room Management</h4>
                <p>Schedule, host, and manage interviews with control over participant access</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section" id="how-it-works">
        <h2>How InterviewMeet Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h4>Create a Meeting</h4>
            <p>Set up a new interview room in seconds, no downloads required</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h4>Share the Link</h4>
            <p>Invite participants with a simple room ID or direct link</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h4>Real-time Analysis</h4>
            <p>Get AI-powered feedback during or after the interview</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section" id="pricing">
        <h2>Choose Your Room Type</h2>
        <p className="pricing-subtitle">Select the perfect plan for your interviewing needs</p>
        
        <div className="pricing-toggle">
          <span className="pricing-toggle-label">Student</span>
          <label className="toggle-switch">
            <input type="checkbox" id="pricing-toggle" />
            <span className="toggle-slider"></span>
          </label>
          <span className="pricing-toggle-label">Company</span>
        </div>
        
        <div id="pricing-container">
          <div className="pricing-cards student-pricing">
            <div className="pricing-card featured">
              <div className="popular-tag">STUDENT PLAN</div>
              <div className="pricing-card-header">
                <h3>Student Access</h3>
                <div className="pricing-amount">
                  <span className="price">₹99</span>
                  <span className="period">/month</span>
                </div>
              </div>
              <div className="pricing-card-body">
                <ul className="pricing-features">
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Unlimited 1-to-1 Practice Sessions</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Real-Time Basic AI Feedback</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>HD Video & Clear Audio</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Easy Room Creation with Peers</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Community Forum Access</span>
                  </li>
                </ul>
              </div>
              <div className="pricing-card-footer">
                <Link to="/create-meeting" className="pricing-btn featured-btn">Subscribe Now</Link>
              </div>
            </div>
          </div>

          <div className="pricing-cards company-pricing">
            <div className="pricing-card">
              <div className="pricing-card-header">
                <h3>Starter</h3>
                <div className="pricing-amount">
                  <span className="price">₹3,500</span>
                  <span className="period">/month</span>
                </div>
              </div>
              <div className="pricing-card-body">
                <p className="interview-limit">Up to 100 interviews/month</p>
                <ul className="pricing-features">
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>1-3 Host Accounts</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Standard AI Analysis</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Basic Recording</span>
                  </li>
                </ul>
              </div>
              <div className="pricing-card-footer">
                <Link to="/create-meeting" className="pricing-btn">Choose Starter</Link>
              </div>
            </div>

            <div className="pricing-card featured">
              <div className="popular-tag">MOST POPULAR</div>
              <div className="pricing-card-header">
                <h3>Professional</h3>
                <div className="pricing-amount">
                  <span className="price">₹15,000</span>
                  <span className="period">/month</span>
                </div>
              </div>
              <div className="pricing-card-body">
                <p className="interview-limit">Up to 1000 interviews/month</p>
                <ul className="pricing-features">
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>5-10 Host Accounts</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Full AI Analysis & Reports</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Company Branding</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Priority Support</span>
                  </li>
                </ul>
              </div>
              <div className="pricing-card-footer">
                <Link to="/create-meeting" className="pricing-btn featured-btn">Choose Professional</Link>
              </div>
            </div>

            <div className="pricing-card">
              <div className="pricing-card-header">
                <h3>Enterprise</h3>
                <div className="pricing-amount">
                  <span className="price">Custom</span>
                  <span className="period">pricing</span>
                </div>
              </div>
              <div className="pricing-card-body">
                <p className="interview-limit">Unlimited interviews & features</p>
                <ul className="pricing-features">
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Custom Host Accounts</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>API Access & ATS Integrations</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Advanced Security Options</span>
                  </li>
                  <li>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    <span>Dedicated Account Manager</span>
                  </li>
                </ul>
              </div>
              <div className="pricing-card-footer">
                <Link to="/create-meeting" className="pricing-btn">Contact Sales</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section" id="testimonials">
        <h2>What Users Say</h2>
        <div className="testimonials">
          <div className="testimonial">
            <p>"InterviewMeet helped me practice for my tech interviews and gave me valuable feedback on my presentation skills."</p>
            <div className="testimonial-author">
              <span className="name">Rahul S.</span>
              <span className="title">Computer Science Student</span>
            </div>
          </div>
          <div className="testimonial">
            <p>"We've streamlined our initial candidate screening process with InterviewMeet, saving our HR team countless hours."</p>
            <div className="testimonial-author">
              <span className="name">Priya M.</span>
              <span className="title">Talent Acquisition Lead</span>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="cta-section">
        <h2>Ready to Get Started?</h2>
        <p>Join thousands of students and companies already using InterviewMeet</p>
        <div className="cta-buttons">
          <button 
            onClick={() => handleAuthNavigation('/create-meeting')} 
            className="cta-button create-cta"
          >
            Create a Meeting
          </button>
          <button 
            onClick={() => handleAuthNavigation('/join-meeting')} 
            className="cta-button join-cta"
          >
            Join a Meeting
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">InterviewMeet</div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#pricing">Pricing</a>
            <a href="#testimonials">Testimonials</a>
          </div>
          <div className="footer-copyright">
            © {new Date().getFullYear()} InterviewMeet. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage; 