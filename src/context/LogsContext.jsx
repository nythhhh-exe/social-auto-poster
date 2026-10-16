import { createContext, useContext, useState, useEffect } from "react"

const LogsContext = createContext(null)

export function LogsProvider({ children }) {
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem("sap_logs")
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem("sap_logs", JSON.stringify(logs.slice(0, 100)))
  }, [logs])

  const addLog = (log) => {
    const timestamp = log.scheduledTime
      ? new Date(log.scheduledTime * 1000).toISOString()
      : (log.timestamp || new Date().toISOString())

    const entry = {
      ...log,
      id: log.id || Date.now() + Math.random().toString(36).substring(2, 6),
      timestamp,
      scheduledTime: log.scheduledTime || undefined,
    }
    setLogs(prev => {
      // If a log with this postId or same caption on same day already exists, update it with correct publication time
      const matchIndex = prev.findIndex(p =>
        (log.postId && p.postId === log.postId) ||
        (log.id && p.id === log.id) ||
        (log.caption && p.caption === log.caption && Math.abs(new Date(p.timestamp || 0) - new Date(timestamp)) < 86400000)
      )
      if (matchIndex >= 0) {
        const next = [...prev]
        next[matchIndex] = { ...next[matchIndex], ...entry, timestamp }
        return next
      }
      return [entry, ...prev]
    })
  }

  const clearLogs = () => setLogs([])

  return (
    <LogsContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LogsContext.Provider>
  )
}

export const useLogs = () => useContext(LogsContext)
