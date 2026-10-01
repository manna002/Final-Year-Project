import { useState } from 'react'
import { Check } from 'lucide-react'
import { logActivity } from '../lib/activityLogger'
import styles from './ThresholdControl.module.css'

export default function ThresholdControl({ kitId, threshLow, threshHigh, threshFan, publish, connected, user, profile }) {
  const [low,  setLow]  = useState('20')
  const [high, setHigh] = useState('60')
  const [fan,  setFan]  = useState('30')
  const [err,  setErr]  = useState('')

  function apply() {
    if (!kitId) return

    const lo = parseInt(low)
    const hi = parseInt(high)
    const fn = parseInt(fan)
    
    if (isNaN(lo) || isNaN(hi) || isNaN(fn)) { setErr('Enter valid numbers'); return }
    if (lo < 1 || lo > 94)      { setErr('Low must be 1–94');    return }
    if (hi < 2 || hi > 95)      { setErr('High must be 2–95');   return }
    if (lo >= hi)                { setErr('Low must be less than High'); return }
    if (fn < 10 || fn > 60)      { setErr('Fan limit must be 10–60'); return }
    
    setErr('')
    
    // Publish separately to dynamic kit topics
    publish(`${kitId}/threshold/low`,  String(lo))
    publish(`${kitId}/threshold/high`, String(hi))
    publish(`${kitId}/threshold/fan`,  String(fn))
    
    if (user) {
      logActivity(user.id, user.email, 'THRESHOLD_SET', `Thresholds set: LOW=${lo}%, HIGH=${hi}%, FAN=${fn}°C`, profile?.device_id || kitId)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.title}>Automation Thresholds</div>

      <div className={styles.current}>
        Current Moisture: <span className={styles.currentVal}>Low: {threshLow || '--'}% | High: {threshHigh || '--'}%</span><br />
        Current Fan Limit: <span className={styles.currentVal}>{threshFan || '--'}°C</span>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} style={{ color: 'var(--red)' }}>
            Valve ON at or below
          </label>
          <div className={styles.inputWrap}>
            <input
              type="number" min="1" max="94"
              value={low}
              onChange={e => setLow(e.target.value)}
              className={styles.input}
              style={{ borderColor: 'var(--red)44' }}
            />
            <span className={styles.unit}>%</span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} style={{ color: 'var(--green)' }}>
            Valve OFF at or above
          </label>
          <div className={styles.inputWrap}>
            <input
              type="number" min="2" max="95"
              value={high}
              onChange={e => setHigh(e.target.value)}
              className={styles.input}
              style={{ borderColor: 'var(--green)44' }}
            />
            <span className={styles.unit}>%</span>
          </div>
        </div>
      </div>

      <div className={styles.row} style={{ marginTop: '14px', marginBottom: '18px' }}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} style={{ color: 'var(--blue)' }}>
            Fan ON at or above
          </label>
          <div className={styles.inputWrap}>
            <input
              type="number" min="10" max="60"
              value={fan}
              onChange={e => setFan(e.target.value)}
              className={styles.input}
              style={{ borderColor: 'var(--blue)44' }}
            />
            <span className={styles.unit}>°C</span>
          </div>
        </div>
      </div>

      {err && <div className={styles.err}>{err}</div>}

      <button
        className={styles.applyBtn}
        onClick={apply}
        disabled={!connected}
      >
        <Check size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} /> Apply Thresholds
      </button>
    </div>
  )
}
