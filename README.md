# Construction Material Management System for ELS Construction

This is the Construction Material Management System for ELS Pvt. Ltd.

## Project Setup Instructions

Follow these steps to set up and run the project locally on your machine.

### 1. Prerequisites
Ensure you have the following installed:
* [Node.js](https://nodejs.org/) (v16 or higher recommended)
* [MongoDB Community Server](https://www.mongodb.com/try/download/community) (running locally on port `27017`), or a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cloud database.

### 2. Clone the Repository
```bash
git clone <repository-url>
cd mern-boilerplate
```

### 3. Setup Environment Variables
Environment files (`.env`) are excluded from Git tracking to protect keys and prevent conflicts. You must create them locally from the templates:

* **Backend Configuration**:
  1. Copy `backend/.env.example` to create `backend/.env`.
  2. Update `MONGO_URI` in `backend/.env` with your database connection details (it defaults to your local MongoDB at `mongodb://127.0.0.1:27017/ConstructionDB`).
  
* **Root Configuration**:
  1. Copy `.env.example` to create `.env` in the root folder.
  2. Edit `.env` as needed.

### 4. Install Dependencies
Since `node_modules` is not tracked in Git, you must install dependencies:

* **Backend dependencies**:
  ```bash
  cd backend
  npm install
  ```
* **Frontend dependencies**:
  ```bash
  cd frontend
  npm install
  ```

### 5. Running the Application
* **Start Backend**:
  ```bash
  cd backend
  npm run dev
  ```
  *(or `npm start` to run with node directly)*
  
* **Start Frontend**:
  ```bash
  cd frontend
  npm start
  ```
