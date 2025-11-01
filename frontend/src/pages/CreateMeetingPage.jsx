import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // Assuming common styles are in App.css or a shared file

const CreateMeetingPage = () => {
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState(''); // Optional: for naming rooms if desired
  const [isLocked, setIsLocked] = useState(true); // Default to locked room
  const navigate = useNavigate();

  // Get user name from localStorage on component mount
  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const parsedUserInfo = JSON.parse(userInfo);
        setUserName(parsedUserInfo.full_name || parsedUserInfo.email || '');
      } catch (e) {
        console.error('Error parsing user info:', e);
      }
    }
  }, []);

  const handleCreateMeeting = (e) => {
    e.preventDefault();
    if (!userName.trim()) {
      alert('Please enter your name.');
      return;
    }
    // Generate a random room ID (can be more sophisticated)
    const newRoomId = Math.random().toString(36).substring(2, 10);
    
    // Navigate to the room, passing necessary state
    navigate(`/room/${newRoomId}`, {
      state: { 
        userName: userName.trim(),
        roomName: roomName.trim(), // Optional
        create_locked_room: isLocked // Flag for App.jsx to know it's a new, locked room creation
      }
    });
  };

  return (
    <div className="join-page-container centered-container">
      <div className="join-form-card">
        <h1 className="form-title">Create New Meeting</h1>
        <form onSubmit={handleCreateMeeting} className="join-form">
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
          {/* Optional: Room Name Input */}
          {/* <div className="form-group">
            <label htmlFor="roomName" className="form-label">Room Name (Optional)</label>
            <input
              type="text"
              id="roomName"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="form-input"
              placeholder="Enter a name for your room"
            />
          </div> */}
          <div className="form-group checkbox-group">
            <input 
              type="checkbox" 
              id="isLocked" 
              checked={isLocked} 
              onChange={(e) => setIsLocked(e.target.checked)} 
              className="form-checkbox"
            />
            <label htmlFor="isLocked" className="form-label-checkbox">Require host approval for participants to join</label>
          </div>
          <button type="submit" className="join-button primary-button">Create & Go to Room</button>
        </form>
      </div>
    </div>
  );
};

export default CreateMeetingPage; 