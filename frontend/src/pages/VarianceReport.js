import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { formatDateTime, formatDayMonth } from '../utils/dateUtils';
import { API_BASE } from '../config';
import Pagination, { usePagination } from '../components/Pagination';
import { getAuthHeaders, fetchWithAuth } from '../utils/authUtils';

const CustomBarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ background: 'white', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', fontSize: '12px' }}>
        <div style={{ fontWeight: '700', color: '#0d1b4b', marginBottom: '6px' }}>{data.materialName}</div>
        <div style={{ color: '#475569', marginBottom: '3px' }}>
          <strong>% of Plan Used:</strong> {data.percentUsed}%
        </div>
        <div style={{ color: '#475569', marginBottom: '3px' }}>
          <strong>Planned Qty:</strong> {Number(data.plannedQty || 0).toLocaleString()} {data.unit || ''}
        </div>
        <div style={{ color: '#475569' }}>
          <strong>Actual Usage:</strong> {Number(data.actualQty || 0).toLocaleString()} {data.unit || ''}
        </div>
      </div>
    );
  }
  return null;
};

const CustomLineTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ background: 'white', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', fontSize: '12px' }}>
        <div style={{ fontWeight: '700', color: '#0d1b4b', marginBottom: '4px' }}>Date: {label}</div>
        <div style={{ color: '#2563eb', fontWeight: '600', marginBottom: '2px' }}>
          Cumulative Usage: {Number(data.quantity || 0).toLocaleString()} units
        </div>
        {data.dailyQty !== undefined && (
          <div style={{ color: '#64748b' }}>
            Day's Usage: {Number(data.dailyQty || 0).toLocaleString()} units
          </div>
        )}
      </div>
    );
  }
  return null;
};

const VarianceReport = () => {
  const [reportData, setReportData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [totalWastageCost, setTotalWastageCost] = useState(0);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getHeaders = () => getAuthHeaders();

  const fetchVarianceData = async () => {
    setLoading(true);
    setError('');
    try {
      const [resVar, resBom, resItems] = await Promise.all([
        fetchWithAuth('/api/material-usage/variance'),
        fetchWithAuth('/api/bom').catch(() => null),
        fetchWithAuth('/api/item-master').catch(() => null)
      ]);
      const data = await resVar.json().catch(() => ({}));
      if (data.success) {
        let bomCostMap = new Map();
        if (resBom && resBom.ok) {
          const bomJson = await resBom.json().catch(() => ({}));
          (bomJson.data || []).forEach(b => {
            (b.materials || []).forEach(m => {
              const key = (b.projectName || '') + ':' + (m.name || '').toLowerCase().trim();
              if (m.estimatedUnitCost) bomCostMap.set(key, Number(m.estimatedUnitCost));
            });
          });
        }

        let itemCostMap = new Map();
        if (resItems && resItems.ok) {
          const itemJson = await resItems.json().catch(() => ({}));
          (itemJson.data || itemJson || []).forEach(i => {
            if (i.materialName && i.estimatedUnitCost) {
              itemCostMap.set(i.materialName.toLowerCase().trim(), Number(i.estimatedUnitCost));
            }
          });
        }

        const enrichedReport = (data.report || []).map(item => {
          const key = (item.projectName || '') + ':' + (item.materialName || '').toLowerCase().trim();
          const unitCost = Number(item.unitCost) || bomCostMap.get(key) || itemCostMap.get((item.materialName || '').toLowerCase().trim()) || 0;
          return {
            ...item,
            unitCost
          };
        });

        setReportData(enrichedReport);
        setTimelineData(data.timeline || []);
        setTotalWastageCost(data.totalWastageCost || 0);
        
        // Extract unique projects
        const uniqueProjects = Array.from(new Set(enrichedReport.map(item => item.projectName)));
        setProjects(uniqueProjects);
      } else {
        throw new Error(data.message || 'Failed to fetch variance report data.');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend.');
      setReportData([]);
      setTimelineData([]);
      setTotalWastageCost(0);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVarianceData();
  }, []);

  // Filter report data based on project selection
  const filteredReport = selectedProject === 'All'
    ? reportData
    : reportData.filter(item => item.projectName === selectedProject);

  // Wastage Insights rows and total calculation
  const wastageRows = filteredReport
    .filter(item => item.severity === 'Moderate' || item.severity === 'Significant')
    .sort((a, b) => (b.wastageCost || 0) - (a.wastageCost || 0));

  const wastagePagination = usePagination(wastageRows, 8, [selectedProject]);
  const variancePagination = usePagination(filteredReport, 8, [selectedProject]);

  const currentTotalWastageCost = filteredReport.reduce((sum, item) => sum + (item.wastageCost || 0), 0);

  const getSeverityBadgeStyle = (severity) => {
    if (severity === 'Significant') {
      return {
        backgroundColor: '#ef444415',
        color: '#dc2626',
        border: '1px solid #ef444430'
      };
    }
    if (severity === 'Moderate') {
      return {
        backgroundColor: '#f59e0b15',
        color: '#d97706',
        border: '1px solid #f59e0b30'
      };
    }
    return {};
  };

  // Grouped material data for Bar Chart (Top 10 materials by usage as % of plan used)
  const materialUsageMap = new Map();
  filteredReport.forEach(item => {
    const matName = item.materialName;
    if (!materialUsageMap.has(matName)) {
      materialUsageMap.set(matName, {
        materialName: matName,
        plannedQty: 0,
        actualQty: 0,
        unit: item.unit
      });
    }
    const entry = materialUsageMap.get(matName);
    entry.plannedQty += (Number(item.plannedQty) || 0);
    entry.actualQty += (Number(item.actualQty) || 0);
    if (!entry.unit && item.unit) entry.unit = item.unit;
  });

  const barChartData = Array.from(materialUsageMap.values())
    .filter(item => item.actualQty > 0)
    .sort((a, b) => b.actualQty - a.actualQty)
    .slice(0, 10)
    .map(item => {
      const pctUsed = item.plannedQty > 0
        ? Number(((item.actualQty / item.plannedQty) * 100).toFixed(1))
        : 100;
      return {
        ...item,
        percentUsed: pctUsed
      };
    });

  // Filter and process timeline data for Line Chart (usage over time)
  const filteredTimeline = selectedProject === 'All'
    ? timelineData
    : timelineData.filter(item => item.projectName === selectedProject);

  // Ignore records with quantity <= 0, sort chronologically, apply running total
  const validTimeline = filteredTimeline.filter(item => (Number(item.actualQty) || 0) > 0);
  const sortedTimeline = [...validTimeline].sort((a, b) => new Date(a.usageDate) - new Date(b.usageDate));

  const dailyMap = new Map();
  sortedTimeline.forEach(curr => {
    const dateStr = formatDayMonth(curr.usageDate);
    const qty = Number(curr.actualQty) || 0;
    if (dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, dailyMap.get(dateStr) + qty);
    } else {
      dailyMap.set(dateStr, qty);
    }
  });

  let runningTotal = 0;
  const lineChartData = Array.from(dailyMap.entries()).map(([dateStr, dailyQty]) => {
    runningTotal += dailyQty;
    return {
      date: dateStr,
      quantity: runningTotal,
      dailyQty
    };
  });

  // Started BOM lines (BOM items where usage has started: actualQty > 0)
  const startedBomLines = filteredReport.filter(item => item.inBom !== false && (Number(item.actualQty) || 0) > 0);

  // Variance Stats Calculation in value terms (qty x unitCost) over started BOM lines
  const totalPlannedValue = startedBomLines.reduce(
    (sum, item) => sum + ((Number(item.plannedQty) || 0) * (Number(item.unitCost) || 0)),
    0
  );
  const totalActualValue = startedBomLines.reduce(
    (sum, item) => sum + ((Number(item.actualQty) || 0) * (Number(item.unitCost) || 0)),
    0
  );

  const overallVariancePct = (startedBomLines.length > 0 && totalPlannedValue > 0)
    ? Number((((totalActualValue - totalPlannedValue) / totalPlannedValue) * 100).toFixed(2))
    : 'N/A';

  // KPI card counts
  const materialsOverBudget = filteredReport.filter(item => (Number(item.actualQty) || 0) > (Number(item.plannedQty) || 0)).length;
  const materialsWithinPlan = filteredReport.filter(item => (Number(item.actualQty) || 0) > 0 && (Number(item.actualQty) || 0) <= (Number(item.plannedQty) || 0)).length;
  const notStartedCount = filteredReport.filter(item => (Number(item.actualQty) || 0) === 0).length;

  const getVarianceColor = (pct) => {
    if (pct === 'N/A' || pct === null || pct === undefined) return '#64748b';
    const numeric = typeof pct === 'number' ? pct : parseFloat(pct);
    if (isNaN(numeric)) return '#64748b';
    if (numeric <= 0) return '#2e7d32'; // Green (within plan or under budget)
    if (numeric <= 15) return '#f59e0b'; // Yellow (0-15% over budget)
    return '#c62828'; // Red (>15% over budget)
  };

  const getVarianceLabel = (pct) => {
    if (pct === 'N/A' || pct === null || pct === undefined) return 'N/A';
    const numeric = typeof pct === 'number' ? pct : parseFloat(pct);
    if (isNaN(numeric)) return 'N/A';
    if (numeric <= 0) return 'Within Plan';
    if (numeric <= 15) return 'Warning (0-15%)';
    return 'Critical Overrun (>15%)';
  };

  // PDF Export
  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Header Banner
    doc.setFillColor(13, 27, 75); // Navy
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("ELS Construction (Pvt) Ltd", 14, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Construction Material Management System (CMMS)", 14, 32);

    // Document Details
    doc.setTextColor(51, 51, 51);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Material Variance Analysis Report", 14, 52);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated Date: ${formatDateTime(new Date())}`, 14, 60);
    doc.text(`Selected Project Profile: ${selectedProject}`, 14, 65);

    // Draw Stats summary in PDF
    doc.setFillColor(245, 246, 250);
    doc.rect(14, 72, 182, 22, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.rect(14, 72, 182, 22, 'S');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("SUMMARY STATUS:", 18, 80);
    doc.setFont("helvetica", "normal");
    const varianceStr = overallVariancePct === 'N/A'
      ? 'N/A'
      : `${overallVariancePct > 0 ? '+' : ''}${overallVariancePct}%`;
    doc.text(`Total Variance: ${varianceStr}`, 18, 88);
    doc.text(`Over Budget: ${materialsOverBudget}`, 72, 88);
    doc.text(`Within Plan: ${materialsWithinPlan}`, 118, 88);
    doc.text(`Not Started: ${notStartedCount}`, 162, 88);

    // Draw Table
    let y = 108;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Material Name", 14, y);
    doc.text("Unit", 68, y);
    doc.text("Planned Qty", 88, y);
    doc.text("Actual Usage", 118, y);
    doc.text("Variance Qty", 148, y);
    doc.text("Variance %", 178, y);
    
    doc.setDrawColor(13, 27, 75);
    doc.setLineWidth(0.5);
    doc.line(14, y + 2, 196, y + 2);
    
    y += 8;
    doc.setFont("helvetica", "normal");
    
    filteredReport.forEach((item) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const isNotStarted = (Number(item.actualQty) || 0) === 0;
      doc.text(item.materialName || '', 14, y);
      doc.text(item.unit || '', 68, y);
      doc.text((item.plannedQty || 0).toLocaleString(), 88, y);
      doc.text((item.actualQty || 0).toLocaleString(), 118, y);
      doc.text(isNotStarted ? '—' : (item.varianceQty || 0).toLocaleString(), 148, y);
      doc.text(isNotStarted ? '—' : `${item.variancePct > 0 ? '+' : ''}${item.variancePct}%`, 178, y);
      
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.1);
      doc.line(14, y + 2, 196, y + 2);
      
      y += 8;
    });

    doc.save(`ELS_Variance_Report_${selectedProject.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Excel Export
  const downloadExcel = () => {
    const varianceStr = overallVariancePct === 'N/A'
      ? 'N/A'
      : `${overallVariancePct > 0 ? '+' : ''}${overallVariancePct}%`;

    const wsData = [
      ["ELS Construction (Pvt) Ltd"],
      ["Material Variance Analysis Report"],
      [`Generated Date: ${formatDateTime(new Date())}`],
      [`Selected Project Profile: ${selectedProject}`],
      [], // Spacer
      ["Summary Statistics"],
      ["Total Variance %", varianceStr],
      ["Materials Over Budget", materialsOverBudget],
      ["Materials Within Plan", materialsWithinPlan],
      ["Not Started", notStartedCount],
      [], // Spacer
      ["Project Name", "Material Name", "Unit", "Planned Qty", "Actual Qty", "Variance Qty", "Variance %", "Budget Status"]
    ];

    filteredReport.forEach(item => {
      const isNotStarted = (Number(item.actualQty) || 0) === 0;
      wsData.push([
        item.projectName,
        item.materialName,
        item.unit,
        item.plannedQty,
        item.actualQty,
        isNotStarted ? '—' : item.varianceQty,
        isNotStarted ? '—' : `${item.variancePct > 0 ? '+' : ''}${item.variancePct}%`,
        isNotStarted ? 'Not Started' : getVarianceLabel(item.variancePct)
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Auto-adjust column widths simple implementation
    const max_cols = wsData.reduce((w, row) => Math.max(w, row.length), 0);
    ws['!cols'] = Array(max_cols).fill({ wch: 18 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Variance Report");
    XLSX.writeFile(wb, `ELS_Variance_Report_${selectedProject.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Filter and Download Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '24px', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontWeight: '600', color: '#0d1b4b', fontSize: '14px' }}>Filter by Project Profile:</label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontWeight: '500', minWidth: '200px', cursor: 'pointer' }}
          >
            <option value="All">All Active Projects</option>
            {projects.map((proj, idx) => (
              <option key={idx} value={proj}>{proj}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={downloadPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0d1b4b', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', transition: 'background 0.2s' }}
          >
            📥 Download PDF Report
          </button>
          <button
            onClick={downloadExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#10b981', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', transition: 'background 0.2s' }}
          >
            📊 Export to Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#0d1b4b', fontWeight: '600' }}>Fetching system variance analytics...</div>
      ) : error && reportData.length === 0 ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      ) : (
        <div>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `5px solid ${getVarianceColor(overallVariancePct)}` }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Total Variance %</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: getVarianceColor(overallVariancePct), marginTop: '8px' }}>
                {overallVariancePct === 'N/A'
                  ? 'N/A'
                  : overallVariancePct > 0
                    ? `+${overallVariancePct}%`
                    : `${overallVariancePct}%`}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Aggregate difference vs BOM plan</div>
            </div>

            <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '5px solid #ef4444' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Materials Over Budget</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444', marginTop: '8px' }}>{materialsOverBudget}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Items exceeding original planning limit</div>
            </div>

            <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '5px solid #10b981' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Materials Within Plan</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', marginTop: '8px' }}>{materialsWithinPlan}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Started items within target planned allowances</div>
            </div>

            <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '5px solid #64748b' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Not Started</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#64748b', marginTop: '8px' }}>{notStartedCount}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Planning lines with no material issued yet</div>
            </div>
          </div>

          {/* Visualizations Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* Bar Chart - Top 10 Materials (% of Plan Used) */}
            <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '15px', fontWeight: '700' }}>🏗️ Material Allocations (Top 10 Materials - % of Plan Used)</h3>
              {barChartData.length === 0 ? (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>No material usage data available for this selection.</div>
              ) : (
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 20, right: 20, left: -10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="materialName"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        unit="%"
                        domain={[0, (dataMax) => Math.max(120, Math.ceil(dataMax / 20) * 20)]}
                      />
                      <Tooltip content={<CustomBarTooltip />} />
                      <ReferenceLine
                        y={100}
                        stroke="#dc2626"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ value: '100% Plan', fill: '#dc2626', fontSize: 11, position: 'top' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Bar dataKey="percentUsed" name="% of Plan Used" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Line Chart - Usage Timeline */}
            <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '15px', fontWeight: '700' }}>📈 Cumulative Material Usage Over Time</h3>
              {lineChartData.length === 0 ? (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>No usage logs available for this project.</div>
              ) : (
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineChartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip content={<CustomLineTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Line type="monotone" dataKey="quantity" name="Cumulative Usage" stroke="#2563eb" strokeWidth={3} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Wastage Insights Section */}
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '24px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#0d1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '15px', fontWeight: '700' }}>Wastage Insights</h3>
              <div style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>
                Total Wastage Cost: <span style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b', marginLeft: '6px' }}>LKR {(currentTotalWastageCost || 0).toLocaleString()}</span>
              </div>
            </div>
            {wastageRows.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#16a34a', fontWeight: '600', background: '#f0fdf4' }}>
                No significant over-consumption detected.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={styles.th}>Material Name</th>
                      <th style={styles.th}>Project Name</th>
                      <th style={styles.th}>Wastage Qty</th>
                      <th style={styles.th}>Unit</th>
                      <th style={styles.th}>Wastage Cost</th>
                      <th style={styles.th}>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wastagePagination.paginatedData.map((item, index) => {
                      const badgeStyle = getSeverityBadgeStyle(item.severity);
                      return (
                        <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? 'white' : '#f8fafc', transition: 'background 0.2s' }}>
                          <td style={{ ...styles.td, fontWeight: '600', color: '#0d1b4b' }}>{item.materialName}</td>
                          <td style={styles.td}>{item.projectName}</td>
                          <td style={{ ...styles.td, color: '#dc2626', fontWeight: '600' }}>{(item.wastageQty || 0).toLocaleString()}</td>
                          <td style={styles.td}>{item.unit}</td>
                          <td style={{ ...styles.td, fontWeight: '700', color: '#dc2626' }}>LKR {(item.wastageCost || 0).toLocaleString()}</td>
                          <td style={styles.td}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '700',
                              ...badgeStyle
                            }}>
                              {item.severity}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <Pagination pagination={wastagePagination} />
              </div>
            )}
          </div>

          {/* Variance Comparison Table */}
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#0d1b4b' }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '15px', fontWeight: '700' }}>📋 Planned Quantity vs Actual Material Usage Variance Registry</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={styles.th}>Project Profile</th>
                    <th style={styles.th}>Material Identifier</th>
                    <th style={styles.th}>Unit</th>
                    <th style={styles.th}>Planned Qty (BOM)</th>
                    <th style={styles.th}>Actual Qty Used</th>
                    <th style={styles.th}>Variance Qty</th>
                    <th style={styles.th}>Variance %</th>
                    <th style={styles.th}>Budget Health Status</th>
                  </tr>
                </thead>
                <tbody>
                  {variancePagination.paginatedData.map((item, index) => {
                    const isNotStarted = (Number(item.actualQty) || 0) === 0;
                    const statusColor = isNotStarted ? '#64748b' : getVarianceColor(item.variancePct);
                    const statusLabel = isNotStarted ? 'Not Started' : getVarianceLabel(item.variancePct);
                    return (
                      <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? 'white' : '#f8fafc', transition: 'background 0.2s' }}>
                        <td style={styles.td}>{item.projectName}</td>
                        <td style={{ ...styles.td, fontWeight: '600', color: '#0d1b4b' }}>{item.materialName}</td>
                        <td style={styles.td}>{item.unit}</td>
                        <td style={styles.td}>{(item.plannedQty || 0).toLocaleString()}</td>
                        <td style={styles.td}>{(item.actualQty || 0).toLocaleString()}</td>
                        <td style={{ ...styles.td, color: isNotStarted ? '#64748b' : (item.varianceQty || 0) > 0 ? '#dc2626' : '#16a34a', fontWeight: '500' }}>
                          {isNotStarted ? '—' : (item.varianceQty || 0) > 0 ? `+${(item.varianceQty || 0).toLocaleString()}` : (item.varianceQty || 0).toLocaleString()}
                        </td>
                        <td style={{ ...styles.td, color: isNotStarted ? '#64748b' : statusColor, fontWeight: 'bold' }}>
                          {isNotStarted ? '—' : item.variancePct > 0 ? `+${item.variancePct}%` : `${item.variancePct}%`}
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: statusColor + '15',
                            color: statusColor,
                            border: `1px solid ${statusColor}30`
                          }}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {variancePagination.paginatedData.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                        No planning or usage records found for this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Pagination pagination={variancePagination} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  td: {
    padding: '14px 16px',
    fontSize: '13px',
    color: '#334155'
  }
};

export default VarianceReport;
