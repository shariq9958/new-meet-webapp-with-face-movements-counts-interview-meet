import React from 'react';
import { useParams } from 'react-router-dom';

const MeetingRoom = () => {
  const { meetingId } = useParams();

  return (
    <div className="min-h-screen bg-gray-800 text-white flex flex-col items-center justify-center p-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-indigo-400">InterviewMeet Room</h1>
        <p className="text-xl text-gray-300 mt-2">Meeting ID: <span className="font-semibold text-indigo-300">{meetingId}</span></p>
      </header>

      <div className="w-full max-w-4xl bg-gray-700 shadow-2xl rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Video Area (Placeholder) */}
          <div className="md:col-span-2 bg-black rounded-lg h-96 flex items-center justify-center text-gray-500">
            <p>Main Video / Screen Share Area</p>
          </div>

          {/* Participants & Chat (Placeholder) */}
          <div className="bg-gray-600 rounded-lg p-4 h-96 flex flex-col">
            <h2 className="text-lg font-semibold mb-3 text-indigo-300">Participants</h2>
            <ul className="space-y-2 overflow-y-auto flex-grow mb-4">
              <li className="text-gray-200">Participant 1 (You)</li>
              <li className="text-gray-200">Participant 2</li>
              {/* More participants */}
            </ul>
            <h2 className="text-lg font-semibold mb-3 text-indigo-300">Chat</h2>
            <div className="flex-grow bg-gray-500 rounded p-2 overflow-y-auto mb-2">
              {/* Chat messages */}
              <p className="text-xs text-gray-300">Chat messages will appear here.</p>
            </div>
            <input type="text" placeholder="Type a message..." className="w-full p-2 rounded bg-gray-800 text-white border border-gray-500 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
        </div>

        {/* Controls (Placeholder) */}
        <div className="mt-6 flex justify-center space-x-4">
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800">
            Mute
          </button>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800">
            Stop Video
          </button>
          <button className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800">
            Leave Meeting
          </button>
          <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800">
            Share Screen
          </button>
        </div>
      </div>

      <footer className="mt-8 text-gray-400 text-sm">
        <p>&copy; {new Date().getFullYear()} InterviewMeet. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default MeetingRoom; 