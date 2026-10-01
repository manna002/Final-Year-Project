import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const AuthContext = createContext(null)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Verify token on load
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetch(`${API_URL}/auth/me`, {
        headers: { 'x-auth-token': token }
      })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          localStorage.removeItem('token')
          setUser(null)
          setProfile(null)
        } else {
          // Normalize to look like old supabase user object for compatibility
          const userData = { id: data._id, email: data.email }
          setUser(userData)
          setProfile({
            id: data._id,
            email: data.email,
            display_name: data.displayName,
            role: data.role
          })
        }
      })
      .catch(err => {
        console.error(err)
        localStorage.removeItem('token')
      })
      .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // Login with email + password
  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    
    localStorage.setItem('token', data.token)
    setUser({ id: data.user.id, email: data.user.email })
    setProfile({
      id: data.user.id,
      email: data.user.email,
      display_name: data.user.displayName,
      role: data.user.role
    })
    return data
  }, [])

  // Sign up with email + password
  const signup = useCallback(async (email, password, displayName, role = 'client', adminCode = '') => {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, accountType: role, adminCode })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Signup failed')
    
    // Auto login after signup
    return login(email, password)
  }, [login])

  // Logout
  const logout = useCallback(async () => {
    localStorage.removeItem('token')
    setUser(null)
    setProfile(null)
  }, [])

  // Reset password (not implemented in custom backend yet)
  const resetPassword = useCallback(async (email) => {
    throw new Error("Password reset not available in MongoDB version yet. Contact Admin.")
  }, [])

  const value = {
    user,
    profile,
    loading,
    login,
    signup,
    logout,
    resetPassword,
    isAdmin: profile?.role === 'admin',
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
