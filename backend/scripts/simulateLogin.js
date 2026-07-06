

const usersToTest = [
  { email: 'admin@els.com', password: 'admin123' },
  { email: 'pm@els.com', password: 'pm123456' },
  { email: 'sitestore@els.com', password: 'store123' },
  { email: 'store@els.com', password: 'store123' },
  { email: 'director@els.com', password: 'director123' } // fallback guess
];

const simulateLogin = async () => {
  console.log('--- Simulating API Login Attempts on Port 5000 ---');
  for (const u of usersToTest) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email, password: u.password })
      });
      const data = await res.json();
      console.log(`\nUser: ${u.email}`);
      console.log(`  Password Used: "${u.password}"`);
      console.log(`  HTTP Status:   ${res.status}`);
      console.log(`  Response:      `, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`  Error connecting to login API for ${u.email}:`, err.message);
    }
  }
};

simulateLogin();
