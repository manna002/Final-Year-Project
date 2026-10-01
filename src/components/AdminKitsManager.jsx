import { useState, useEffect } from 'react'
import AdminLiveMonitor from './AdminLiveMonitor'
import styles from './AdminKitsManager.module.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function AdminKitsManager({ users }) {
  const [kits, setKits] = useState([])
  const [loading, setLoading] = useState(true)
  const [newKitId, setNewKitId] = useState('')
  const [newKitName, setNewKitName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [viewingKit, setViewingKit] = useState(null)

  useEffect(() => {
    fetchKits()
  }, [])

  async function fetchKits() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/kits`, {
        headers: { 'x-auth-token': token }
      })
      if (!res.ok) throw new Error('Failed to fetch kits')
      const data = await res.json()
      setKits(data || [])
    } catch (err) {
      console.error('Error fetching kits:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddKit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    if (!newKitId.trim()) {
      setError('Kit ID is required')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/kits`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({
          kit_id: newKitId.trim(),
          name: newKitName.trim() || 'FUNAAB IMS'
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add kit')
      
      setSuccess('Kit added successfully!')
      setNewKitId('')
      setNewKitName('')
      setKits([data, ...kits])
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAssignUser(kitId, userId) {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/kits/${kitId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({ owner_id: userId || null })
      })
      if (!res.ok) throw new Error('Failed to assign user')
      const updatedKit = await res.json()
      setKits(kits.map(k => k._id === kitId ? updatedKit : k))
    } catch (err) {
      alert('Failed to assign kit: ' + err.message)
    }
  }

  async function handleDeleteKit(kitId) {
    if (!window.confirm('Are you sure you want to delete this kit?')) return

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/kits/${kitId}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      })
      if (!res.ok) throw new Error('Failed to delete kit')
      
      setKits(kits.filter(k => k._id !== kitId))
      if (viewingKit?._id === kitId) setViewingKit(null)
    } catch (err) {
      alert('Failed to delete kit: ' + err.message)
    }
  }

  if (viewingKit) {
    return (
      <AdminLiveMonitor 
        kit={viewingKit} 
        onBack={() => setViewingKit(null)} 
      />
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Kits Management</h2>
        <p>Register new microcontrollers and assign them to clients</p>
      </div>

      <div className={styles.addForm}>
        <h3>Register New Kit</h3>
        <form onSubmit={handleAddKit} className={styles.formGroup}>
          <input
            type="text"
            placeholder="Kit ID (e.g. FUNAAB-KIT-001)"
            value={newKitId}
            onChange={e => setNewKitId(e.target.value)}
            className={styles.input}
            required
          />
          <input
            type="text"
            placeholder="Display Name (optional)"
            value={newKitName}
            onChange={e => setNewKitName(e.target.value)}
            className={styles.input}
          />
          <button type="submit" className={styles.btnPrimary}>Add Kit</button>
        </form>
        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}
      </div>

      <div className={styles.list}>
        <h3>Registered Kits ({kits.length})</h3>
        
        {loading ? (
          <p>Loading kits...</p>
        ) : kits.length === 0 ? (
          <p className={styles.empty}>No kits registered yet.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Kit ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Assigned Client</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {kits.map(kit => (
                  <tr key={kit._id}>
                    <td className={styles.kitId}>{kit.kit_id}</td>
                    <td>{kit.name}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${kit.status === 'ONLINE' ? styles.online : styles.offline}`}>
                        {kit.status || 'OFFLINE'}
                      </span>
                    </td>
                    <td>
                      <select 
                        value={kit.owner_id?._id || kit.owner_id || ''} 
                        onChange={(e) => handleAssignUser(kit._id, e.target.value)}
                        className={styles.select}
                      >
                        <option value="">-- Unassigned --</option>
                        {users.map(u => (
                          <option key={u.id || u._id} value={u.id || u._id}>
                            {u.display_name || u.displayName} ({u.email})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button 
                          className={styles.btnMonitor}
                          onClick={() => setViewingKit(kit)}
                        >
                          Monitor Live
                        </button>
                        <button 
                          className={styles.btnDelete}
                          onClick={() => handleDeleteKit(kit._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
