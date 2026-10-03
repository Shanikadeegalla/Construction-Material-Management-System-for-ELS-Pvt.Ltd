import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';
import { MATERIAL_CATEGORIES } from '../constants/materialCategories';

// Loads the live material category list (built-in defaults + categories the
// Admin has added). Falls back to the built-in defaults if the API is unreachable.
// `customCategories` are the Admin-added ones (the only ones that can be removed).
export default function useMaterialCategories() {
  const [categories, setCategories] = useState(MATERIAL_CATEGORIES);
  const [customCategories, setCustomCategories] = useState([]);

  const reloadCategories = useCallback(async () => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`${API_BASE}/api/material-categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCategories(data.data);
        setCustomCategories(data.custom || []);
      }
    } catch (err) {
      // keep the built-in defaults
    }
  }, []);

  useEffect(() => { reloadCategories(); }, [reloadCategories]);

  return { categories, customCategories, reloadCategories };
}
