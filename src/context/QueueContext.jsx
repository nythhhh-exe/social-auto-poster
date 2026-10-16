import { createContext, useContext, useState, useEffect } from "react"

const QueueContext = createContext(null)

export function QueueProvider({ children }) {
  const [queue, setQueue] = useState(() => {
    const saved = localStorage.getItem("nexus_post_queue")
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem("nexus_post_queue", JSON.stringify(queue))
  }, [queue])

  const addToQueue = (item) => {
    const entry = {
      ...item,
      id: Date.now() + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString(),
      status: "scheduled", // scheduled | published | cancelled
    }
    setQueue(prev => [entry, ...prev])
    return entry
  }

  const removeFromQueue = (id) => {
    setQueue(prev => prev.filter(q => q.id !== id))
  }

  const updateQueueItem = (id, updates) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q))
  }

  const clearQueue = () => setQueue([])

  return (
    <QueueContext.Provider
      value={{
        queue,
        addToQueue,
        removeFromQueue,
        updateQueueItem,
        clearQueue,
      }}
    >
      {children}
    </QueueContext.Provider>
  )
}

export const useQueue = () => useContext(QueueContext)
