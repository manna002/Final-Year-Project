import { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Calendar, Filter, Activity, FlaskConical, Thermometer, Droplet, Droplets, Sprout, Sparkles
} from 'lucide-react';
import styles from './AnalysisPanel.module.css';

export default function AnalysisPanel({ kitId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [preset, setPreset] = useState('7'); // '1', '7', '30', 'custom'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'NUTRIENTS', 'CLIMATE'

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
      
      // Format dates for X-axis
      const formattedData = json.map(log => ({
        ...log,
        displayDate: new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + log.timeSlot,
        nitrogen: log.nitrogen !== undefined ? parseFloat(log.nitrogen) : 0,
        phosphorus: log.phosphorus !== undefined ? parseFloat(log.phosphorus) : 0,
        potassium: log.potassium !== undefined ? parseFloat(log.potassium) : 0,
        temperature: log.temperature !== undefined ? parseFloat(log.temperature) : 0,
        humidity: log.humidity !== undefined ? parseFloat(log.humidity) : 0,
        moisture: log.moisture !== undefined ? parseFloat(log.moisture) : 0,
      }));
      
      setData(formattedData);
    } catch (err) {
      console.error("Failed to fetch analysis data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  // Statistics calculation for badges
  const stats = useMemo(() => {
    const calc = (key) => {
      if (!data || data.length === 0) return { latest: '--', avg: '--' };
      const vals = data.map(d => d[key]).filter(v => v !== undefined && !isNaN(v));
      if (vals.length === 0) return { latest: '--', avg: '--' };
      const latest = vals[vals.length - 1].toFixed(1);
      const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
      return { latest, avg };
    };
    return {
      nitrogen: calc('nitrogen'),
      phosphorus: calc('phosphorus'),
      potassium: calc('potassium'),
      moisture: calc('moisture'),
      temperature: calc('temperature'),
      humidity: calc('humidity'),
    };
  }, [data]);

  // Configuration for 6 individual graphs
  const chartConfigs = [
    {
      id: 'nitrogen',
      category: 'NUTRIENTS',
      title: 'Nitrogen (N) Concentration',
      unit: 'mg/kg',
      icon: <FlaskConical size={18} />,
      color: '#3b82f6',
      dataKey: 'nitrogen',
      stat: stats.nitrogen
    },
    {
      id: 'phosphorus',
      category: 'NUTRIENTS',
      title: 'Phosphorus (P) Concentration',
      unit: 'mg/kg',
      icon: <Sprout size={18} />,
      color: '#10b981',
      dataKey: 'phosphorus',
      stat: stats.phosphorus
    },
    {
      id: 'potassium',
      category: 'NUTRIENTS',
      title: 'Potassium (K) Concentration',
      unit: 'mg/kg',
      icon: <Sparkles size={18} />,
      color: '#f59e0b',
      dataKey: 'potassium',
      stat: stats.potassium
    },
    {
      id: 'moisture',
      category: 'CLIMATE',
      title: 'Volumetric Soil Moisture',
      unit: '%',
      icon: <Droplet size={18} />,
      color: '#06b6d4',
      dataKey: 'moisture',
      stat: stats.moisture
    },
    {
      id: 'temperature',
      category: 'CLIMATE',
      title: 'Greenhouse Ambient Temperature',
      unit: '°C',
      icon: <Thermometer size={18} />,
      color: '#ef4444',
      dataKey: 'temperature',
      stat: stats.temperature
    },
    {
      id: 'humidity',
      category: 'CLIMATE',
      title: 'Relative Air Humidity',
      unit: '%',
      icon: <Droplets size={18} />,
      color: '#8b5cf6',
      dataKey: 'humidity',
      stat: stats.humidity
    },
  ];

  const visibleCharts = chartConfigs.filter(c => activeFilter === 'ALL' || c.category === activeFilter);

  return (
    <div className={styles.container}>
      {/* Top Header & Range Controls */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Activity size={24} className={styles.icon} />
          <div>
            <h2>Precision Agriculture Analytics</h2>
            <p className={styles.subtitle}>Independent parameter trend tracking & sensor diagnostics</p>
          </div>
        </div>
        
        <div className={styles.controls}>
          {/* Preset Time Buttons */}
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

      {/* Category Filter Pills */}
      <div className={styles.filterBar}>
        <button 
          className={`${styles.filterPill} ${activeFilter === 'ALL' ? styles.activeFilter : ''}`}
          onClick={() => setActiveFilter('ALL')}
        >
          All 6 Charts
        </button>
        <button 
          className={`${styles.filterPill} ${activeFilter === 'NUTRIENTS' ? styles.activeFilter : ''}`}
          onClick={() => setActiveFilter('NUTRIENTS')}
        >
          Soil Nutrients (N, P, K)
        </button>
        <button 
          className={`${styles.filterPill} ${activeFilter === 'CLIMATE' ? styles.activeFilter : ''}`}
          onClick={() => setActiveFilter('CLIMATE')}
        >
          Climate & Soil Moisture
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading sensor trends...</div>
      ) : data.length === 0 ? (
        <div className={styles.empty}>No log records found for this time period.</div>
      ) : (
        <div className={styles.graphsGrid}>
          {visibleCharts.map(c => (
            <div key={c.id} className={styles.graphCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle} style={{ color: c.color }}>
                  {c.icon}
                  <h3>{c.title}</h3>
                </div>
                <div className={styles.statBadges}>
                  <span className={styles.badge}>Latest: <strong>{c.stat.latest} {c.unit}</strong></span>
                  <span className={styles.badgeMuted}>Avg: <strong>{c.stat.avg} {c.unit}</strong></span>
                </div>
              </div>

              <div className={styles.graphWrapper}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`grad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={c.color} stopOpacity={0.35}/>
                        <stop offset="95%" stopColor={c.color} stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis 
                      dataKey="displayDate" 
                      stroke="var(--text-muted)" 
                      fontSize={11} 
                      tickMargin={8} 
                    />
                    <YAxis 
                      stroke="var(--text-muted)" 
                      fontSize={11} 
                      unit={` ${c.unit}`}
                      width={65}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--surface)', 
                        borderColor: 'var(--border)', 
                        borderRadius: '8px', 
                        color: 'var(--text-main)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }} 
                      formatter={(val) => [`${val} ${c.unit}`, c.title]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={c.dataKey} 
                      stroke={c.color} 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill={`url(#grad-${c.id})`}
                      dot={{ r: 2, fill: c.color }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
