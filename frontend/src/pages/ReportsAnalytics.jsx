import React from 'react';
import ReportsAnalyticsDashboard from '../components/ReportsAnalyticsDashboard';

/**
 * Reports & Analytics Page (Module 5 & 6 Requirements)
 * Integrates:
 * - Executive KPI Summary Cards
 * - Monthly Material Consumption Trend & Stock Distribution by Category (Middle Row)
 * - BOM vs Actual Material Usage Variance Analysis (Bottom Section)
 * - Print-ready PDF & Multi-sheet Excel exports
 */
export default function ReportsAnalytics(props) {
  return <ReportsAnalyticsDashboard {...props} />;
}
