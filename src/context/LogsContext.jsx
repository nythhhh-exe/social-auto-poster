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
    const entry = { ...log, id: Date.now(), timestamp: new Date().toISOString() }
    setLogs(prev => [entry, ...prev])
  }

  const clearLogs = () => setLogs([])

  return (
    <LogsContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LogsContext.Provider>
  )
}

export const useLogs = () => useContext(LogsContext)
