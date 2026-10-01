import { useRef } from 'react'
import { Droplet, Fan, Container } from 'lucide-react'
import { logActivity } from '../lib/activityLogger'
import styles from './PumpControl.module.css'

const MODES = ['MANUAL', 'AUTO', 'TIMER']

export default function PumpControl({ kitId, relayState, tankState, fanState, mode, publish, connected, user, profile }) {
  const isManual = mode === 'MANUAL'

  function changeMode(m) {
    if (!kitId) return
    publish(`${kitId}/mode/state`, m)
    if (user) {
      logActivity(user.id, user.email, 'MODE_CHANGE', `Mode changed to ${m}`, profile?.device_id || kitId)
    }
  }

  const lastToggleRef = useRef(0)

  function controlPump(cmd) {
    if (!kitId) return
    
    // Prevent mobile "ghost clicks" (double-firing) by throttling to 1 action per 500ms
    const now = Date.now()
    if (now - lastToggleRef.current < 500) return
    lastToggleRef.current = now

    publish(`${kitId}/relay/state`, cmd)
    if (user) {
      const action = cmd === 'ON' ? 'PUMP_ON' : cmd === 'OFF' ? 'PUMP_OFF' : 'PUMP_TOGGLE'
      logActivity(user.id, user.email, action, `Pump ${cmd}`, profile?.device_id || kitId)
    }
  }

  function controlTank(cmd) {
    if (!kitId) return
    const now = Date.now()
    if (now - lastToggleRef.current < 500) return
    lastToggleRef.current = now

    publish(`${kitId}/tank/state`, cmd)
    if (user) {
      logActivity(user.id, user.email, cmd === 'ON' ? 'PUMP_ON' : 'PUMP_OFF', `Tank filling ${cmd}`, profile?.device_id || kitId)
    }
  }

  function controlFan(cmd) {
    if (!kitId) return
    const now = Date.now()
    if (now - lastToggleRef.current < 500) return
    lastToggleRef.current = now

    publish(`${kitId}/fan/state`, cmd)
    if (user) {
      logActivity(user.id, user.email, cmd === 'ON' ? 'PUMP_ON' : 'PUMP_OFF', `Fan power ${cmd}`, profile?.device_id || kitId)
    }
  }

  function resetFlow() {
    if (!kitId) return
    publish(`${kitId}/flowreset`, '1')
    if (user) {
      logActivity(user.id, user.email, 'FLOW_RESET', 'Flow counter reset', profile?.device_id || kitId)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.title}>Valve & Mode Control</div>

      {/* MODE SELECTOR */}
      <div className={styles.section}>
        <div className={styles.label}>Operating Mode</div>
        <div className={styles.modeRow}>
          {MODES.map(m => (
            <button
              key={m}
              className={`${styles.modeBtn} ${mode === m ? styles.modeBtnActive : ''}`}
              onClick={() => changeMode(m)}
              disabled={!connected}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* IRRIGATION VALVE */}
      <div className={styles.section}>
        <div className={styles.label}>
          <Droplet size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
          Irrigation Valve
        </div>
        <div className={styles.pumpRow}>
          <div className={`${styles.pumpIndicator} ${relayState === 'ON' ? styles.pumpOn : styles.pumpOff}`}>
            <span className={styles.pumpDot} />
            {relayState}
          </div>
          {!isManual && (
            <div className={styles.autoNote}>
              Valve controlled by {mode} mode
            </div>
          )}
        </div>

        {isManual && (
          <div className={styles.switchWrapper}>
            <span className={styles.switchLabel}>Valve Power</span>
            <label className={`${styles.switch} ${!connected ? styles.disabled : ''}`}>
              <input
                type="checkbox"
                checked={relayState === 'ON'}
                onChange={(e) => controlPump(e.target.checked ? 'ON' : 'OFF')}
                disabled={!connected}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
        )}
      </div>

      {/* TANK FILLING */}
      <div className={styles.section}>
        <div className={styles.label}>
          <Container size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
          Tank Filling
        </div>
        <div className={styles.pumpRow}>
          <div className={`${styles.pumpIndicator} ${tankState === 'ON' ? styles.pumpOn : styles.pumpOff}`}>
            <span className={styles.pumpDot} />
            {tankState || 'OFF'}
          </div>
          {!isManual && (
            <div className={styles.autoNote}>
              Tank controlled by {mode} mode
            </div>
          )}
        </div>

        {isManual && (
          <div className={styles.switchWrapper}>
            <span className={styles.switchLabel}>Tank Fill Power</span>
            <label className={`${styles.switch} ${!connected ? styles.disabled : ''}`}>
              <input
                type="checkbox"
                checked={tankState === 'ON'}
                onChange={(e) => controlTank(e.target.checked ? 'ON' : 'OFF')}
                disabled={!connected}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
        )}
      </div>

      {/* FAN POWER */}
      <div className={styles.section}>
        <div className={styles.label}>
          <Fan size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
          Fan Power
        </div>
        <div className={styles.pumpRow}>
          <div className={`${styles.pumpIndicator} ${fanState === 'ON' ? styles.pumpOn : styles.pumpOff}`}>
            <span className={styles.pumpDot} />
            {fanState || 'OFF'}
          </div>
          {!isManual && (
            <div className={styles.autoNote}>
              Fan controlled by {mode} mode
            </div>
          )}
        </div>
        
        {isManual && (
          <div className={styles.switchWrapper}>
            <span className={styles.switchLabel}>Fan Power</span>
            <label className={`${styles.switch} ${!connected ? styles.disabled : ''}`}>
              <input
                type="checkbox"
                checked={fanState === 'ON'}
                onChange={(e) => controlFan(e.target.checked ? 'ON' : 'OFF')}
                disabled={!connected}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
        )}
      </div>

      {/* FLOW RESET */}
      <div className={styles.section}>
        <button
          className={styles.resetBtn}
          onClick={resetFlow}
          disabled={!connected}
        >
          Reset Flow Counter
        </button>
      </div>
    </div>
  )
}

