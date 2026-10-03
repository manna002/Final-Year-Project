import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import useMqtt from '../hooks/useMqtt'
import SensorCards from '../components/SensorCards'
import PumpControl from '../components/PumpControl'
import ThresholdControl from '../components/ThresholdControl'
import TimerSlots from '../components/TimerSlots'
import RtcSetter from '../components/RtcSetter'
import EventLog from '../components/EventLog'
import AlertBanner from '../components/AlertBanner'
import SensorChart from '../components/SensorChart'
import styles from './DashboardPage.module.css'

const TABS = ['Monitor', 'Control', 'Timers', 'Log']

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('Monitor')
  
  // Kit Management State
  const [kits, setKits] = useState([])
  const [selectedKitId, setSelectedKitId] = useState('')
  const [loadingKits, setLoadingKits] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    
    async function fetchKits() {
      try {
        const token = localStorage.getItem('token')
        const baseUrl = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
        const res = await fetch(`${baseUrl}/kits/my-kits`, {
          headers: { 'x-auth-token': token }
        })
        
        if (res.ok) {
          const data = await res.json()
          
          if (data && data.length > 0) {
            // Map MongoDB _id to id to avoid breaking the rest of the app
            const mappedData = data.map(k => ({ ...k, id: k._id }))
            setKits(mappedData)
            const activeKitId = mappedData[0].kit_id || mappedData[0].kitId
            console.log('Selected Kit ID for MQTT:', activeKitId, 'Raw kit data:', mappedData[0])
            setSelectedKitId(activeKitId)
          }
        }
      } catch (err) {
        console.error('Error fetching kits:', err)
      } finally {
        setLoadingKits(false)
      }
    }
    fetchKits()

    // Without Supabase, we don't have realtime postgres_changes for kits. 
    // If you need realtime, you'd wire it via Socket.io. For now, it fetches on mount.
  }, [user?.id])

  // Initialize MQTT connection with the selected kit
  const mqtt = useMqtt(selectedKitId)

  if (loadingKits) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Loading your assigned kits...</p>
      </div>
    )
  }

  if (kits.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <h2>No Kits Assigned</h2>
        <p>You haven't been assigned any Smart Irrigation Kits yet.</p>
        <p>Please contact your administrator to assign a microcontroller to your account.</p>
      </div>
    )
  }

  return (
    <>
      {/* KIT SELECTOR */}
      <div className={styles.kitSelector}>
        <label>Active Kit:</label>
        {kits.length > 1 ? (
          <select 
            value={selectedKitId} 
            onChange={(e) => setSelectedKitId(e.target.value)}
            className={styles.kitDropdown}
          >
            {kits.map(k => (
              <option key={k.id} value={k.kit_id}>
                {(k.name === 'New Smart Kit' ? 'FUNAAB IMS' : (k.name || k.kit_id))} ({mqtt.espStatus || k.status})
              </option>
            ))}
          </select>
        ) : (
          <span className={styles.singleKitName}>
            {(kits[0].name === 'New Smart Kit' ? 'FUNAAB IMS' : (kits[0].name || kits[0].kit_id))}
            <span className={`${styles.kitBadge} ${mqtt.espStatus === 'ONLINE' ? styles.online : styles.offline}`}>
              {mqtt.espStatus || kits[0].status}
            </span>
          </span>
        )}
      </div>

      {/* ALERT BANNER */}
      {mqtt.alerts.length > 0 && (
        <AlertBanner alerts={mqtt.alerts} />
      )}

      {/* FEEDBACK BAR */}
      {mqtt.feedback && (
        <div className={styles.feedbackBar}>
          <span className={styles.feedbackIcon}>↩</span>
          <span className={styles.feedbackText}>{mqtt.feedback.msg}</span>
          <span className={styles.feedbackTime}>{mqtt.feedback.ts}</span>
        </div>
      )}

      {/* TABS */}
      <nav className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* CONTENT */}
      <main className={styles.main}>
        {tab === 'Monitor' && (
          <div className={styles.monitorGrid}>
            <SensorCards sensors={mqtt.sensors} relayState={mqtt.relayState} mode={mqtt.mode} />
            <SensorChart tempHistory={mqtt.tempHistory} moistHistory={mqtt.moistHistory} />
          </div>
        )}

        {tab === 'Control' && (
          <div className={styles.controlGrid}>
            <PumpControl
              kitId={selectedKitId}
              relayState={mqtt.relayState}
              tankState={mqtt.tankState}
              fanState={mqtt.fanState}
              mode={mqtt.mode}
              publish={mqtt.publish}
              connected={mqtt.connected}
              user={user}
              profile={profile}
            />
            <ThresholdControl
              kitId={selectedKitId}
              threshLow={mqtt.threshLow}
              threshHigh={mqtt.threshHigh}
              threshFan={mqtt.threshFan}
              publish={mqtt.publish}
              connected={mqtt.connected}
              user={user}
              profile={profile}
            />
            <RtcSetter
              kitId={selectedKitId}
              publish={mqtt.publish}
              connected={mqtt.connected}
              user={user}
              profile={profile}
            />
          </div>
        )}
        {tab === 'Timers' && (
          <TimerSlots
            kitId={selectedKitId}
            timersJson={mqtt.timersJson}
            publish={mqtt.publish}
            connected={mqtt.connected}
            user={user}
            profile={profile}
          />
        )}

        {tab === 'Log' && (
          <EventLog logs={mqtt.logs} />
        )}
      </main>
    </>
  )
}
