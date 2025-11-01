import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CreateMeeting = () => {
  const [meetingName, setMeetingName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5001/api/v1/meetings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          name: meetingName
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Navigate to the meeting room with the meeting ID
        navigate(`/meeting/${data.meeting_id}`);
      } else {
        setError(data.detail || 'Failed to create meeting');
      }
    } catch (err) {
      setError('An error occurred while creating the meeting');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-indigo-600 mb-6">
          Create New Meeting
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateMeeting} className="space-y-4">
          <div>
            <label htmlFor="meetingName" className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Name
            </label>
            <input
              type="text"
              id="meetingName"
              value={meetingName}
              onChange={(e) => setMeetingName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter meeting name"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Creating...' : 'Create Meeting'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateMeeting; 