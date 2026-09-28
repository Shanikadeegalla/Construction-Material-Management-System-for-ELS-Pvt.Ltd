# ELS Construction (Pvt) Ltd - Construction Material Management System (CMMS)

A modern MERN-stack enterprise web platform designed for ELS Construction (Pvt) Ltd to manage end-to-end construction material workflows, site store isolation, BOM planning, procurement, goods receipts, material issuance, variance reporting, and supplier invoice settlements.

---

## 🚀 Key Features & Domain Scoping

- **Isolated Site Store Tracking**: Strict per-project inventory isolation prevents cross-project material pooling.
- **Multilevel Stock Alerts**: Tiered inventory monitoring (`Critical`, `Reorder`, `Overstock`) with automated status badges.
- **BOM Cumulative Limit Protection**: Enforces cumulative Purchase Request limits against approved Bill of Quantities (BOM).
- **Payment Gateway & Manual Settlement**: Supports Stripe online checkout as well as manual Cash & Cheque payment recording with automatic Invoice status updates.
- **Role-Based Access Control (RBAC)**: Gated permissions across 6 operational roles (`Admin`, `Director`, `ProjectManager`, `PurchaseManager`, `MainStoreOfficer`, `SiteStoreOfficer`).
- **Audit Logging**: Immutable operational log tracking key system transactions.

---

## 🛠️ Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: Local MongoDB instance or MongoDB Atlas cluster URI

---

## ⚙️ Step-by-Step Installation & Setup

### 1. Repository Setup & Dependencies

```bash
# Clone the repository
git clone https://github.com/Shanikadeegalla/Construction-Material-Management-System-for-ELS-Pvt.Ltd.git
cd Construction-Material-Management-System-for-ELS-Pvt.Ltd

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Configuration

Copy the example environment files and configure your keys:

```bash
# Backend Environment Setup
cd ../backend
cp .env.example .env

# Frontend Environment Setup
cd ../frontend
cp .env.example .env
```

Ensure your `backend/.env` contains valid values for:
- `MONGO_URI`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `STRIPE_SECRET_KEY`

---

## 🧪 Seeding Demo Data for Viva / Demonstration

Run the automated idempotent demo seeder script to populate pristine demo accounts, active projects, approved BOMs, Item Master items, and suppliers:

```bash
cd backend
npm run seed:demo
```

### Seeded Viva Demonstration Accounts (Default Password: `Password123!`)
- **Admin**: `admin@elslanka.com`
- **Director**: `director@elslanka.com`
- **Project Manager**: `pm@elslanka.com`
- **Purchase Manager**: `purchase@elslanka.com`
- **Main Store Officer**: `mainstore@elslanka.com`
- **Site Store Officer**: `sitestore@elslanka.com`

---

## 🧪 Running Automated Unit Tests

Run the Jest unit test suite covering password policy, encryption roundtrips, BOM versioning, and negative stock assertions:

```bash
cd backend
npm test
```

---

## 🖥️ Running Development Servers

### 1. Start Backend API Server
```bash
cd backend
npm run dev
# Server running on http://localhost:5000
```

### 2. Start Frontend React Application
```bash
cd frontend
npm start
# Client running on http://localhost:3000
```

---

## 📄 Documentation & System Test Specification

For a complete manual testing specification detailing all 10 core role scenarios (`TC01` - `TC10`), view the [docs/SYSTEM_TEST_CASES.md](file:///c:/Users/USER/.gemini/antigravity/scratch/mern-boilerplate/docs/SYSTEM_TEST_CASES.md) document.
