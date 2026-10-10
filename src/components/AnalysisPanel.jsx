import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Calendar, Filter, Activity, FlaskConical } from 'lucide-react';
import styles from './AnalysisPanel.module.css';

export default function AnalysisPanel({ kitId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [preset, setPreset] = useState('7'); // '1', '7', '30', 'custom'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `/api/reports/water/${kitId}?`;
      if (preset === 'custom' && fromDate && toDate) {
        url += `from=${fromDate}&to=${toDate}`;
      } else {
        url += `days=${preset}`;
      }
      
      const res = await fetch(url);
      const json = await res.json();
      
      // Format dates for the X-axis
      const formattedData = json.map(log => ({
        ...log,
        displayDate: new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + log.timeSlot
      }));
      
      setData(formattedData);
    } catch (err) {
      console.error("Failed to fetch analysis data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set default custom dates to today and 7 days ago if empty
    if (!fromDate) {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setFromDate(d.toISOString().split('T')[0]);
    }
    if (!toDate) {
      setToDate(new Date().toISOString().split('T')[0]);
    }
  }, []);

  useEffect(() => {
    if (preset !== 'custom' || (preset === 'custom' && fromDate && toDate)) {
      fetchData();
    }
  }, [preset, fromDate, toDate]);

  return (
    <div className={styles.container}>
      {/* Header & Controls */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Activity size={24} className={styles.icon} />
          <h2>Data Analysis & Graphs</h2>
        </div>
        
        <div className={styles.controls}>
          <div className={styles.presets}>
            <button className={`${styles.presetBtn} ${preset === '1' ? styles.active : ''}`} onClick={() => setPreset('1')}>1 Day</button>
            <button className={`${styles.presetBtn} ${preset === '7' ? styles.active : ''}`} onClick={() => setPreset('7')}>7 Days</button>
            <button className={`${styles.presetBtn} ${preset === '30' ? styles.active : ''}`} onClick={() => setPreset('30')}>30 Days</button>
            <button className={`${styles.presetBtn} ${preset === 'custom' ? styles.active : ''}`} onClick={() => setPreset('custom')}>
              <Calendar size={16} /> Custom
            </button>
          </div>
          
          {preset === 'custom' && (
            <div className={styles.datePicker}>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={styles.dateInput} />
              <span>to</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={styles.dateInput} />
              <button onClick={fetchData} className={styles.applyBtn}><Filter size={16}/></button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading graph data...</div>
      ) : data.length === 0 ? (
        <div className={styles.empty}>No data found for this time period.</div>
      ) : (
        <div className={styles.graphsGrid}>
          
          {/* NPK Graph */}
          <div className={styles.graphCard}>
            <h3><FlaskConical size={18} /> Soil Nutrient Levels (NPK)</h3>
            <div className={styles.graphWrapper}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="displayDate" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: '#fff' }} />
                  <Legend verticalAlign="top" height={36}/>
                  <Area type="monotone" dataKey="nitrogen" name="Nitrogen (N)" stroke="#3b82f6" fillOpacity={0.3} fill="#3b82f6" />
                  <Area type="monotone" dataKey="phosphorus" name="Phosphorus (P)" stroke="#10b981" fillOpacity={0.3} fill="#10b981" />
                  <Area type="monotone" dataKey="potassium" name="Potassium (K)" stroke="#f59e0b" fillOpacity={0.3} fill="#f59e0b" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Climate Graph */}
          <div className={styles.graphCard}>
            <h3><Activity size={18} /> Climate (Temperature & Humidity)</h3>
            <div className={styles.graphWrapper}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="displayDate" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                  <YAxis yAxisId="left" stroke="#ef4444" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: '#fff' }} />
                  <Legend verticalAlign="top" height={36}/>
                  <Line yAxisId="left" type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#ef4444" strokeWidth={3} dot={{r:3}} activeDot={{r:6}} />
                  <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#3b82f6" strokeWidth={3} dot={{r:3}} activeDot={{r:6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
