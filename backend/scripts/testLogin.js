

const testLogin = async () => {
  const users = [
    { email: 'admin@els.com', password: 'admin123' },
    { email: 'admino@els.com', password: 'admin123' },
    { email: 'promanager@gmail.com', password: 'pm123' },
    { email: 'pofficer@gmail.com', password: 'purchase123' },
    { email: 'store@els.com', password: 'store123' }
  ];

  for (const user of users) {
    try {
      console.log(`\nAttempting login for ${user.email}...`);
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        console.log(`✅ Success! Logged in as ${data.data.name} (Role: ${data.data.role})`);
        console.log(`   Token: ${data.data.token.substring(0, 20)}...`);
      } else {
        console.log(`❌ Failed: Status ${res.status} - ${data.message || JSON.stringify(data)}`);
      }
    } catch (err) {
      console.error(`❌ Network error: ${err.message}`);
    }
  }
};

testLogin();
