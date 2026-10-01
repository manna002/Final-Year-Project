import { useEffect, useState } from 'react'
import supabase from '../lib/supabase'
import AdminUserTable from '../components/AdminUserTable'
import ActivityFeed from '../components/ActivityFeed'
import AdminKitsManager from '../components/AdminKitsManager'
import styles from './AdminPage.module.css'

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [activities, setActivities] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingActivities, setLoadingActivities] = useState(true)

  const [activeTab, setActiveTab] = useState('clients') // 'clients' or 'kits'

  // Fetch all user profiles
  useEffect(() => {
    async function fetchUsers() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/users', {
          headers: { 'x-auth-token': token }
        });
        if (res.ok) {
          const data = await res.json();
          // Map MongoDB _id to id so other components don't break
          const mappedUsers = data.map(u => ({ ...u, id: u._id, display_name: u.displayName }));
          setUsers(mappedUsers);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      }
      setLoadingUsers(false);
    }
    fetchUsers();
  }, []);

  // Fetch activities (Dummy data for now since Supabase is removed)
  useEffect(() => {
    setActivities([]);
    setLoadingActivities(false);
  }, []);

  // Compute stats
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const activeToday = users.filter(u =>
    u.last_login && new Date(u.last_login) >= todayStart
  ).length
  const actionsToday = activities.filter(a =>
    new Date(a.created_at) >= todayStart
  ).length
  const latestAction = activities.length > 0 ? activities[0] : null

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Admin Dashboard</h1>
        <p className={styles.pageSub}>Monitor all client activities and manage hardware</p>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'clients' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('clients')}
        >
          Clients & Activity
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'kits' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('kits')}
        >
          Smart Kits Management
        </button>
      </div>

      {activeTab === 'clients' ? (
        <>
          {/* Stats bar */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{users.length}</div>
              <div className={styles.statLabel}>Total Clients</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{activeToday}</div>
              <div className={styles.statLabel}>Active Today</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{actionsToday}</div>
              <div className={styles.statLabel}>Actions Today</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue + ' ' + styles.statSmall}>
                {latestAction
                  ? new Date(latestAction.created_at).toLocaleTimeString()
                  : '—'
                }
              </div>
              <div className={styles.statLabel}>Last Activity</div>
            </div>
          </div>

          {/* Main content */}
          <div className={styles.grid}>
            <div className={styles.tableArea}>
              {loadingUsers ? (
                <div className={styles.loading}>Loading users...</div>
              ) : (
                <AdminUserTable
                  users={users}
                  selectedUserId={selectedUserId}
                  onSelectUser={setSelectedUserId}
                />
              )}
            </div>

            <div className={styles.feedArea}>
              {loadingActivities ? (
                <div className={styles.loading}>Loading activities...</div>
              ) : (
                <ActivityFeed
                  activities={activities}
                  filterUserId={selectedUserId}
                />
              )}
            </div>
          </div>
        </>
      ) : (
        <AdminKitsManager users={users} />
      )}
    </div>
  )
}
