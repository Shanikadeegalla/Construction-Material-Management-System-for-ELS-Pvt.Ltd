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

### Demonstration Accounts
Set `DEMO_USER_PASSWORD` in `backend/.env` (8+ characters with upper and lower case, a digit and a symbol) before seeding. Any of these accounts that does not exist yet is created with that password; existing accounts are never changed. Change the passwords from the Admin screen afterwards.

- **Admin**: `adminO@els.com`
- **Director**: `director@els.com`
- **Project Manager**: `pm@els.com`
- **Purchase Manager**: `PurchaseManager@els.com`
- **Main Store Officer**: `store@els.com`
- **Site Store Officer**: `sitestore@els.com`

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

## 💳 Stripe CLI & Payment Testing Guide

To test Stripe payment checkout and webhooks locally:

1. **Install Stripe CLI**: Download and install the [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. **Authenticate Stripe CLI**:
   ```bash
   stripe login
   ```
3. **Forward Webhooks to Backend**:
   ```bash
   stripe listen --forward-to localhost:5000/api/payments/webhook
   ```
   Copy the `whsec_...` secret printed by the CLI into `STRIPE_WEBHOOK_SECRET` in `backend/.env`.
4. **Test Cards**:
   - **Successful Payment**: Use `4242 4242 4242 4242` with any future expiry date and CVC `123`.
   - **Declined Card (Failure Handling)**: Use `4000 0000 0000 0002`.
   - **Cancelled Checkout**: Click "Cancel and return" on the Stripe Checkout page; invoice remains unpaid (`Approved` / `Pending Payment`).

---

## 📄 Documentation & System Test Specification

For a complete manual testing specification detailing all 10 core role scenarios (`TC01` - `TC10`), view the [docs/SYSTEM_TEST_CASES.md](file:///c:/Users/USER/.gemini/antigravity/scratch/mern-boilerplate/docs/SYSTEM_TEST_CASES.md) document.

