const verifyLogins = async () => {
  const credentials = [
    { label: 'Director (email director@els.com, pwd dir123)', body: { email: 'director@els.com', password: 'dir123' } },
    { label: 'Director (email director@els.com, pwd director123)', body: { email: 'director@els.com', password: 'director123' } },
    { label: 'Director (username director, pwd dir123)', body: { email: 'director', password: 'dir123' } },
    { label: 'Director Yushika (email yushika@els.com, pwd dir123)', body: { email: 'yushika@els.com', password: 'dir123' } },
    { label: 'Admin (email admin@els.com, pwd admin123)', body: { email: 'admin@els.com', password: 'admin123' } },
    { label: 'PM (email pm@els.com, pwd pm123456)', body: { email: 'pm@els.com', password: 'pm123456' } },
    { label: 'Purchase Manager (email purchase@els.com, pwd purchase123)', body: { email: 'purchase@els.com', password: 'purchase123' } },
    { label: 'Store Officer (email store@els.com, pwd store123)', body: { email: 'store@els.com', password: 'store123' } }
  ];

  console.log('=== Verifying Login API Endpoint ===\n');

  for (const item of credentials) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        console.log(`✅ SUCCESS: ${item.label}`);
        console.log(`   User: "${data.data.name}" | Role: "${data.data.role}" | Token: ${data.data.token.substring(0, 15)}...\n`);
      } else {
        console.log(`❌ FAILED: ${item.label}`);
        console.log(`   Status: ${res.status} | Message: ${data.message || JSON.stringify(data)}\n`);
      }
    } catch (err) {
      console.error(`❌ NETWORK ERROR for ${item.label}:`, err.message);
    }
  }
};

verifyLogins();
