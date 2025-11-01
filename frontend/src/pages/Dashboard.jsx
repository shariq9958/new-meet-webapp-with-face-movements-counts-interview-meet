import React from 'react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const userEmail = localStorage.getItem('userEmail');
  const userType = localStorage.getItem('userType');

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {userEmail}
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            You are logged in as a {userType}
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {/* Create Meeting Card */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Create New Meeting
              </h3>
              <p className="text-gray-500 mb-6">
                Start a new meeting and invite others to join
              </p>
              <Link
                to="/create-meeting"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Create Meeting
              </Link>
            </div>
          </div>

          {/* Join Meeting Card */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Join Meeting
              </h3>
              <p className="text-gray-500 mb-6">
                Join an existing meeting using a meeting ID
              </p>
              <Link
                to="/join-meeting"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Join Meeting
              </Link>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              localStorage.removeItem('authToken');
              localStorage.removeItem('userEmail');
              localStorage.removeItem('userType');
              window.location.href = '/login';
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 