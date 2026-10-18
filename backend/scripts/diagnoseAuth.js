import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

async function testVariations() {
  const variations = [
    { label: "PurchaseManager@els.com", body: { email: 'PurchaseManager@els.com', password: 'Purchase@123' } },
    { label: "Admin adminO@els.com", body: { email: 'adminO@els.com', password: 'admin123' } },
    { label: "Director director@els.com", body: { email: 'director@els.com', password: 'dir123' } }
  ];

  console.log('--- TESTING VARIOUS LOGIN PAYLOADS AGAINST BACKEND (port 5000) ---');
  for (const v of variations) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v.body)
      });
      const data = await res.json();
      console.log(`[${v.label}] HTTP ${res.status}: success=${data.success}, message=${data.message || 'OK'}, userEmail=${data.data?.email}`);
    } catch (err) {
      console.error(`[${v.label}] Error:`, err.message);
    }
  }
}

testVariations();
