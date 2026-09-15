const API_URL = 'http://localhost:5000/api/payments';

const getAuthHeaders = () => {
  const user = localStorage.getItem('user');
  let token = null;
  if (user) {
    try {
      token = JSON.parse(user)?.token;
    } catch (e) {
      token = null;
    }
  }
  if (!token) token = localStorage.getItem('token');

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

// Creates a Stripe Checkout Session for a given purchaseOrderId and redirects browser to returned Stripe checkout URL
export const createCheckoutSession = async (purchaseOrderId) => {
  const res = await fetch(`${API_URL}/create-checkout-session`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ purchaseOrderId })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to initialize payment checkout session.');
  }

  if (data.url) {
    window.location.href = data.url;
  }
  return data;
};

// Fetches payment status and history for a given purchaseOrderId
export const getPaymentStatus = async (purchaseOrderId) => {
  const res = await fetch(`${API_URL}/${purchaseOrderId}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch payment status.');
  }
  return data.data;
};

// Downloads PDF payment report from GET /api/payments/report
export const downloadPaymentReport = async (filters = {}) => {
  const queryParams = new URLSearchParams();
  if (filters.from) queryParams.append('from', filters.from);
  if (filters.to) queryParams.append('to', filters.to);
  if (filters.status) queryParams.append('status', filters.status);

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  const headers = getAuthHeaders();
  delete headers['Content-Type'];

  const res = await fetch(`${API_URL}/report${queryString}`, {
    method: 'GET',
    headers
  });

  if (!res.ok) {
    throw new Error('Failed to generate payment report PDF.');
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payment-report-${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Fetches JSON payment receipt details for a Purchase Order
export const getPaymentReceipt = async (purchaseOrderId) => {
  const res = await fetch(`${API_URL}/${purchaseOrderId}/receipt`, {
    method: 'GET',
    headers: getAuthHeaders()
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch payment receipt details.');
  }
  return data.data;
};

// Downloads PDF payment receipt for a Purchase Order
export const downloadPaymentReceipt = async (purchaseOrderId) => {
  const headers = getAuthHeaders();
  delete headers['Content-Type'];

  const res = await fetch(`${API_URL}/${purchaseOrderId}/receipt/download`, {
    method: 'GET',
    headers
  });

  if (!res.ok) {
    throw new Error('Failed to generate payment receipt PDF.');
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `receipt-${purchaseOrderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
