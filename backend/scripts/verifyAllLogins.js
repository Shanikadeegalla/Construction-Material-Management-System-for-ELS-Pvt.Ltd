const verifyLogins = async () => {
  const credentials = [
    { label: 'Admin (adminO@els.com / admin123)', body: { email: 'adminO@els.com', password: 'admin123' } },
    { label: 'Purchase Manager (PurchaseManager@els.com / Purchase@123)', body: { email: 'PurchaseManager@els.com', password: 'Purchase@123' } },
    { label: 'Director (director@els.com / dir123)', body: { email: 'director@els.com', password: 'dir123' } },
    { label: 'Project Manager (pm@els.com / pm123456)', body: { email: 'pm@els.com', password: 'pm123456' } },
    { label: 'Main Store Officer (store@els.com / store123)', body: { email: 'store@els.com', password: 'store123' } },
    { label: 'Site Store Officer (sitestore@els.com / site123)', body: { email: 'sitestore@els.com', password: 'site123' } }
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
