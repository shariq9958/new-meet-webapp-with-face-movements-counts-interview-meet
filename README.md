# InterviewMeet

A video interview platform for students and companies with AI-powered feedback.

## Features

- User authentication (login/signup)
- Different pricing plans for students and companies
- Video interview rooms with real-time communication
- Protected routes requiring authentication

## Tech Stack

- **Frontend**: React, React Router, Socket.io
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)

## Getting Started

### Prerequisites

- Node.js 14+
- PostgreSQL database
- npm or yarn

### Setup PostgreSQL Database

1. Create a PostgreSQL database named `interviewmeet`
2. Run the SQL schema provided in the project

### Environment Configuration

Create a `.env` file in the `backend` directory with the following variables:

```
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=interviewmeet
JWT_SECRET=your_jwt_secret_key
```

### Installation

1. Install dependencies for root, frontend, and backend:

```bash
npm run install-all
```

Alternatively, you can install dependencies separately:

```bash
# Root dependencies
npm install

# Frontend dependencies
cd frontend
npm install

# Backend dependencies
cd ../backend
npm install
```

### Running the Application

Start both backend and frontend concurrently:

```bash
npm run dev
```

Or run them separately:

```bash
# Run backend only
npm run backend

# Run frontend only
npm run frontend
```

Backend server will run on: http://localhost:5000
Frontend server will run on: http://localhost:5173

## Project Structure

```
interviewmeet/
├── backend/                # Node.js/Express backend
│   ├── config/             # Database and other configurations
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Authentication middleware
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   └── server.js           # Entry point
├── frontend/               # React frontend
│   ├── public/             # Static files
│   ├── src/                # Source code
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   └── App.jsx         # Main app component
│   └── index.html          # HTML template
└── package.json            # Root dependencies and scripts
``` 