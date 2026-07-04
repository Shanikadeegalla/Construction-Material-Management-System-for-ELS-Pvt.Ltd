import React, { useState, useEffect } from 'react';

function Inventory() {
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState({
    name: '', category: 'Cement', unit: 'kg',
    quantity: 0, minimumStock: 10,
    location: 'MainStore', unitPrice: 0, description: ''
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/inventory');
      const data = await res.json();
      setMaterials(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/inventory/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      setMessage(data.message);
      fetchMaterials();
    } catch (err) {
      setMessage('Error adding material');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>Inventory Management</h2>

      {message && <p style={{ color: 'green' }}>{message}</p>}

      <form onSubmit={handleSubmit} style={{ marginBottom: '30px' }}>
        <h3>Add Material</h3>
        <input placeholder="Name" value={form.name}
          onChange={e => setForm({...form, name: e.target.value})}
          required style={{ margin: '5px', padding: '8px' }} />

        <select value={form.category}
          onChange={e => setForm({...form, category: e.target.value})}
          style={{ margin: '5px', padding: '8px' }}>
          {['Cement','Steel','Bricks','Sand','Gravel','Wood','Paint','Other']
            .map(c => <option key={c}>{c}</option>)}
        </select>

        <select value={form.unit}
          onChange={e => setForm({...form, unit: e.target.value})}
          style={{ margin: '5px', padding: '8px' }}>
          {['kg','ton','litre','piece','bag','m3']
            .map(u => <option key={u}>{u}</option>)}
        </select>

        <input type="number" placeholder="Quantity" value={form.quantity}
          onChange={e => setForm({...form, quantity: e.target.value})}
          style={{ margin: '5px', padding: '8px' }} />

        <input type="number" placeholder="Min Stock" value={form.minimumStock}
          onChange={e => setForm({...form, minimumStock: e.target.value})}
          style={{ margin: '5px', padding: '8px' }} />

        <input type="number" placeholder="Unit Price" value={form.unitPrice}
          onChange={e => setForm({...form, unitPrice: e.target.value})}
          style={{ margin: '5px', padding: '8px' }} />

        <select value={form.location}
          onChange={e => setForm({...form, location: e.target.value})}
          style={{ margin: '5px', padding: '8px' }}>
          <option>MainStore</option>
          <option>SiteStore</option>
        </select>

        <br/>
        <button type="submit"
          style={{ margin: '10px 5px', padding: '10px 20px',
            background: 'green', color: 'white', border: 'none',
            borderRadius: '5px', cursor: 'pointer' }}>
          Add Material
        </button>
      </form>

      <h3>Stock List</h3>
      <table border="1" cellPadding="8" style={{ width: '100%' }}>
        <thead style={{ background: '#f0f0f0' }}>
          <tr>
            <th>Name</th><th>Category</th><th>Unit</th>
            <th>Quantity</th><th>Min Stock</th>
            <th>Location</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {materials.map(m => (
            <tr key={m._id}
              style={{ background: m.quantity <= m.minimumStock ? '#ffe0e0' : 'white' }}>
              <td>{m.name}</td>
              <td>{m.category}</td>
              <td>{m.unit}</td>
              <td>{m.quantity}</td>
              <td>{m.minimumStock}</td>
              <td>{m.location}</td>
              <td style={{ color: m.quantity <= m.minimumStock ? 'red' : 'green' }}>
                {m.quantity <= m.minimumStock ? '⚠️ Low Stock' : '✅ OK'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Inventory;