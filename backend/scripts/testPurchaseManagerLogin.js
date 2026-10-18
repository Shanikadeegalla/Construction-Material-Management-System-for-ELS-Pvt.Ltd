async function testLogin() {
  const variations = [
    { label: "PurchaseManager@els.com with Purchase@123", body: { email: "PurchaseManager@els.com", password: "Purchase@123" } },
    { label: "purchasemanager@els.com with Purchase@123", body: { email: "purchasemanager@els.com", password: "Purchase@123" } }
  ];

  console.log("=== Testing Purchase Manager Logins against Port 5000 ===");
  for (const v of variations) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v.body)
      });
      const data = await res.json();
      console.log(`[${v.label}] HTTP ${res.status}: success=${data.success}, message=${data.message || 'OK'}, userEmail=${data.data?.email}, role=${data.data?.role}`);
    } catch (err) {
      console.error(`[${v.label}] Error:`, err.message);
    }
  }
}

testLogin();
