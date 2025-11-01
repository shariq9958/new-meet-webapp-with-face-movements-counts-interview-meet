import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // Assuming common styles are in App.css or a shared file
// import '../JoinPage.css'; // Or if you have specific styles for join forms

const JoinMeetingPage = () => {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleJoinMeeting = (e) => {
    e.preventDefault();
    if (!userName.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!roomId.trim()) {
      alert('Please enter the Room ID.');
      return;
    }
    navigate(`/room/${roomId.trim()}`, {
      state: { 
        userName: userName.trim(),
        // No create_locked_room flag needed here, as we are joining an existing room
      }
    });
  };

  return (
    <div className="join-page-container centered-container">
      <div className="join-form-card">
        <h1 className="form-title">Join Existing Meeting</h1>
        <form onSubmit={handleJoinMeeting} className="join-form">
          <div className="form-group">
            <label htmlFor="userName" className="form-label">Your Name</label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="form-input"
              placeholder="Enter your name"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="roomId" className="form-label">Room ID</label>
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="form-input"
              placeholder="Enter Room ID"
              required
            />
          </div>
          <button type="submit" className="join-button primary-button">Join Meeting</button>
        </form>
      </div>
    </div>
  );
};

export default JoinMeetingPage; 