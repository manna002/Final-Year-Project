import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import styles from './ReportsPanel.module.css';

export default function ReportsPanel({ kitId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatDate = (date) => date.toISOString().split('T')[0];
  
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const [fromDate, setFromDate] = useState(formatDate(sevenDaysAgo));
  const [toDate, setToDate] = useState(formatDate(today));

  const fetchReports = async () => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');
      const res = await fetch(`${baseUrl}/reports/water/${kitId}?from=${fromDate}&to=${toDate}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [kitId]);

  const downloadCSV = () => {
    if (logs.length === 0) return;
    
    const headers = ['Date', 'Time Slot', 'Temp (C)', 'Humidity (%)', 'Moisture (%)', 'Total Water Used (Liters)'];
    const rows = logs.map(log => {
      const dateStr = new Date(log.timestamp).toLocaleDateString();
      return [
        dateStr,
        log.timeSlot,
        log.temperature,
        log.humidity,
        log.moisture,
        log.totalLitres
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${kitId}_Report_${fromDate}_to_${toDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h3>Historical Data & Analysis</h3>
        <button 
          onClick={downloadCSV} 
          className={styles.downloadBtn}
          disabled={logs.length === 0}
        >
          Download Excel/CSV Report
        </button>
      </div>
      
      <div className={styles.dateFilters}>
        <div className={styles.dateInputGroup}>
          <label>From:</label>
          <input 
            type="date" 
            value={fromDate} 
            onChange={(e) => setFromDate(e.target.value)}
            className={styles.dateInput}
          />
        </div>
        
        <div className={styles.dateInputGroup}>
          <label>To:</label>
          <input 
            type="date" 
            value={toDate} 
            onChange={(e) => setToDate(e.target.value)}
            className={styles.dateInput}
          />
        </div>

        <button onClick={fetchReports} className={styles.refreshBtn}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <p>Loading historical data...</p>
        ) : logs.length === 0 ? (
          <p>No recorded data found for this period. (Note: Data is logged automatically at 6AM, 8AM, 10AM, 12PM, 2PM, 4PM, and 6PM).</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Temp (°C)</th>
                <th>Humidity (%)</th>
                <th>Moisture (%)</th>
                <th>Water Used (L)</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log._id}>
                  <td>{new Date(log.timestamp).toLocaleDateString()}</td>
                  <td>{log.timeSlot}</td>
                  <td>{log.temperature.toFixed(1)}</td>
                  <td>{log.humidity.toFixed(1)}</td>
                  <td>{log.moisture.toFixed(1)}</td>
                  <td>{log.totalLitres.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
