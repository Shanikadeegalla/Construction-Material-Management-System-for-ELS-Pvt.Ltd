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
  ResponsiveContainer
} from 'recharts';

const VarianceReport = () => {
  const [reportData, setReportData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getHeaders = () => {
    const token = JSON.parse(localStorage.getItem('user'))?.token;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  const fetchVarianceData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/material-usage/variance', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setReportData(data.report || []);
        setTimelineData(data.timeline || []);
        
        // Extract unique projects
        const uniqueProjects = Array.from(new Set((data.report || []).map(item => item.projectName)));
        setProjects(uniqueProjects);
      } else {
        throw new Error(data.message || 'Failed to fetch variance report data.');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend.');
      // Mock data for demo purposes if backend fails
      const mockReport = [
        { projectName: 'Colombo Port Expansion', materialName: 'Portland Cement', unit: 'bags', plannedQty: 300, actualQty: 315, varianceQty: 15, variancePct: 5.0 },
        { projectName: 'Colombo Port Expansion', materialName: 'TMT Steel 12mm', unit: 'ton', plannedQty: 10, actualQty: 12, varianceQty: 2, variancePct: 20.0 },
        { projectName: 'Colombo Port Expansion', materialName: 'River Sand', unit: 'm3', plannedQty: 50, actualQty: 48, varianceQty: -2, variancePct: -4.0 },
        { projectName: 'Marina Heights', materialName: 'Portland Cement', unit: 'bags', plannedQty: 500, actualQty: 560, varianceQty: 60, variancePct: 12.0 },
        { projectName: 'Marina Heights', materialName: 'TMT Steel 12mm', unit: 'ton', plannedQty: 15, actualQty: 15.5, varianceQty: 0.5, variancePct: 3.33 },
      ];
      setReportData(mockReport);
      setProjects(['Colombo Port Expansion', 'Marina Heights']);
      
      const mockTimeline = [
        { projectName: 'Colombo Port Expansion', materialName: 'Portland Cement', actualQty: 100, usageDate: '2026-06-20', recordedBy: 'Mike Storekeeper' },
        { projectName: 'Colombo Port Expansion', materialName: 'Portland Cement', actualQty: 150, usageDate: '2026-06-22', recordedBy: 'Mike Storekeeper' },
        { projectName: 'Colombo Port Expansion', materialName: 'Portland Cement', actualQty: 65, usageDate: '2026-06-25', recordedBy: 'Mike Storekeeper' },
        { projectName: 'Colombo Port Expansion', materialName: 'TMT Steel 12mm', actualQty: 5, usageDate: '2026-06-21', recordedBy: 'Mike Storekeeper' },
        { projectName: 'Colombo Port Expansion', materialName: 'TMT Steel 12mm', actualQty: 7, usageDate: '2026-06-24', recordedBy: 'Mike Storekeeper' },
      ];
      setTimelineData(mockTimeline);
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

  // Grouped material data for Bar Chart (Plan vs Actual per material)
  const barChartData = filteredReport.reduce((acc, curr) => {
    const existing = acc.find(item => item.materialName === curr.materialName);
    if (existing) {
      existing.plannedQty += curr.plannedQty;
      existing.actualQty += curr.actualQty;
    } else {
      acc.push({
        materialName: curr.materialName,
        plannedQty: curr.plannedQty,
        actualQty: curr.actualQty
      });
    }
    return acc;
  }, []);

  // Filter and process timeline data for Line Chart (usage over time)
  const filteredTimeline = selectedProject === 'All'
    ? timelineData
    : timelineData.filter(item => item.projectName === selectedProject);

  // Group timeline by date (accumulate actual quantities for chart)
  const lineChartData = Object.values(
    filteredTimeline.reduce((acc, curr) => {
      const dateStr = new Date(curr.usageDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (!acc[dateStr]) {
        acc[dateStr] = { date: dateStr, quantity: 0 };
      }
      acc[dateStr].quantity += curr.actualQty;
      return acc;
    }, {})
  ).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Variance Stats Calculation
  const totalPlanned = filteredReport.reduce((sum, item) => sum + item.plannedQty, 0);
  const totalActual = filteredReport.reduce((sum, item) => sum + item.actualQty, 0);
  const overallVariancePct = totalPlanned > 0
    ? Number((((totalActual - totalPlanned) / totalPlanned) * 100).toFixed(2))
    : 0;

  const materialsOverBudget = filteredReport.filter(item => item.variancePct > 0).length;
  const materialsUnderBudget = filteredReport.filter(item => item.variancePct <= 0).length;

  const getVarianceColor = (pct) => {
    if (pct <= 5) return '#2e7d32'; // Green (within 5% or under budget)
    if (pct > 5 && pct <= 15) return '#f59e0b'; // Yellow (5-15% over budget)
    return '#c62828'; // Red (>15% over budget)
  };

  const getVarianceLabel = (pct) => {
    if (pct <= 5) return 'Within 5% / Under';
    if (pct > 5 && pct <= 15) return 'Warning (5-15%)';
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
    doc.text(`Generated Date: ${new Date().toLocaleString()}`, 14, 60);
    doc.text(`Selected Project Profile: ${selectedProject}`, 14, 65);

    // Draw Stats summary in PDF
    doc.setFillColor(245, 246, 250);
    doc.rect(14, 72, 182, 22, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.rect(14, 72, 182, 22, 'S');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("SUMMARY STATUS:", 20, 80);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Variance: ${overallVariancePct}%`, 20, 88);
    doc.text(`Materials Over Plan: ${materialsOverBudget}`, 85, 88);
    doc.text(`Materials Under/Within Plan: ${materialsUnderBudget}`, 145, 88);

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
      doc.text(item.materialName, 14, y);
      doc.text(item.unit, 68, y);
      doc.text(item.plannedQty.toLocaleString(), 88, y);
      doc.text(item.actualQty.toLocaleString(), 118, y);
      doc.text(item.varianceQty.toLocaleString(), 148, y);
      doc.text(`${item.variancePct}%`, 178, y);
      
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.1);
      doc.line(14, y + 2, 196, y + 2);
      
      y += 8;
    });

    doc.save(`ELS_Variance_Report_${selectedProject.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Excel Export
  const downloadExcel = () => {
    const wsData = [
      ["ELS Construction (Pvt) Ltd"],
      ["Material Variance Analysis Report"],
      [`Generated Date: ${new Date().toLocaleString()}`],
      [`Selected Project Profile: ${selectedProject}`],
      [], // Spacer
      ["Summary Statistics"],
      ["Total Variance %", `${overallVariancePct}%`],
      ["Materials Over Budget", materialsOverBudget],
      ["Materials Under Budget", materialsUnderBudget],
      [], // Spacer
      ["Project Name", "Material Name", "Unit", "Planned Qty", "Actual Qty", "Variance Qty", "Variance %", "Budget Status"]
    ];

    filteredReport.forEach(item => {
      wsData.push([
        item.projectName,
        item.materialName,
        item.unit,
        item.plannedQty,
        item.actualQty,
        item.varianceQty,
        `${item.variancePct}%`,
        getVarianceLabel(item.variancePct)
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
                {overallVariancePct > 0 ? `+${overallVariancePct}%` : `${overallVariancePct}%`}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Aggregate difference vs BOM plan</div>
            </div>

            <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '5px solid #ef4444' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Materials Over Budget</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444', marginTop: '8px' }}>{materialsOverBudget}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Items exceeding original planning limit</div>
            </div>

            <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '5px solid #10b981' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Materials Under Budget</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', marginTop: '8px' }}>{materialsUnderBudget}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Items within target planned allowances</div>
            </div>
          </div>

          {/* Visualizations Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* Bar Chart - Plan vs Actual */}
            <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#0d1b4b', fontSize: '15px', fontWeight: '700' }}>🏗️ Material Allocations (Planned vs Actual)</h3>
              {barChartData.length === 0 ? (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>No data available for chart.</div>
              ) : (
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="materialName" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Bar dataKey="plannedQty" name="Planned Quantity" fill="#0d1b4b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actualQty" name="Actual Usage" fill="#ff9800" radius={[4, 4, 0, 0]} />
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
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <Line type="monotone" dataKey="quantity" name="Total Units Consumed" stroke="#ff9800" strokeWidth={3} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
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
                  {filteredReport.map((item, index) => {
                    const statusColor = getVarianceColor(item.variancePct);
                    return (
                      <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? 'white' : '#f8fafc', transition: 'background 0.2s' }}>
                        <td style={styles.td}>{item.projectName}</td>
                        <td style={{ ...styles.td, fontWeight: '600', color: '#0d1b4b' }}>{item.materialName}</td>
                        <td style={styles.td}>{item.unit}</td>
                        <td style={styles.td}>{item.plannedQty.toLocaleString()}</td>
                        <td style={styles.td}>{item.actualQty.toLocaleString()}</td>
                        <td style={{ ...styles.td, color: item.varianceQty > 0 ? '#dc2626' : '#16a34a', fontWeight: '500' }}>
                          {item.varianceQty > 0 ? `+${item.varianceQty.toLocaleString()}` : item.varianceQty.toLocaleString()}
                        </td>
                        <td style={{ ...styles.td, color: statusColor, fontWeight: 'bold' }}>
                          {item.variancePct > 0 ? `+${item.variancePct}%` : `${item.variancePct}%`}
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
                            {getVarianceLabel(item.variancePct)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredReport.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                        No planning or usage records found for this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
