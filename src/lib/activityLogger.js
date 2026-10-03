// Activity logger stub - Supabase has been removed.
// Activities are now logged via the backend API if needed.

export async function logActivity(userId, userEmail, action, details, deviceId = 'manna') {
  // No-op: Supabase logging removed. 
  // Could be wired to POST /api/activities in the future.
  console.log(`[Activity] ${action}: ${details}`)
}
