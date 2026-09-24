const testImageCredentials = async () => {
  const credentials = [
    { email: 'admino@els.com', pwd: 'admin123', label: 'Admino' },
    { email: 'PurchaseManager@els.com', pwd: 'Purchase@123', label: 'Purchase Manager (Purchase@123)' },
    { email: 'purchasemanager@els.com', pwd: 'purchase123', label: 'Purchase Manager (purchase123)' },
    { email: 'director@els.com', pwd: 'dir123', label: 'Director' },
    { email: 'pm@els.com', pwd: 'pm123456', label: 'PM' },
    { email: 'store@els.com', pwd: 'store123', label: 'Store' },
    { email: 'sitestore@els.com', pwd: 'site123.', label: 'Site Store (site123.)' },
    { email: 'sitestore@els.com', pwd: 'site123', label: 'Site Store (site123)' },
    { email: 'sitestore@els.com', pwd: 'store123', label: 'Site Store (store123)' }
  ];

  console.log('=== Testing Exact Handwritten Image Credentials ===\n');

  for (const c of credentials) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: c.email, password: c.pwd })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        console.log(`✅ SUCCESS: ${c.label}`);
        console.log(`   Email: "${c.email}" | Password: "${c.pwd}" | Role: "${data.data.role}" | User: "${data.data.name}"\n`);
      } else {
        console.log(`❌ FAILED: ${c.label}`);
        console.log(`   Email: "${c.email}" | Password: "${c.pwd}" | Status: ${res.status} | Message: ${data.message || JSON.stringify(data)}\n`);
      }
    } catch (err) {
      console.error(`❌ NETWORK ERROR for ${c.label}:`, err.message);
    }
  }
};

testImageCredentials();
