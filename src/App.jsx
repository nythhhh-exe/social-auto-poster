import { useState } from "react"
import { Routes, Route } from "react-router-dom"
import { Menu, Zap } from "lucide-react"
import Sidebar from "./components/Sidebar"
import Dashboard from "./pages/Dashboard"
import CreatePost from "./pages/CreatePost"
import Accounts from "./pages/Accounts"
import History from "./pages/History"
import Settings from "./pages/Settings"
import ScheduleHub from "./pages/ScheduleHub"
import WarmUp from "./pages/WarmUp"
import { ToastProvider } from "./context/ToastContext"
import { AccountsProvider } from "./context/AccountsContext"
import { LogsProvider } from "./context/LogsContext"
import { QueueProvider } from "./context/QueueContext"

export default function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <AccountsProvider>
      <LogsProvider>
        <QueueProvider>
          <ToastProvider>
            {/* Mobile Top Navbar (Active on screens <= 768px) */}
            <header className="mobile-navbar">
              <div className="mobile-brand">
                <div className="brand-emblem-container" style={{ width: 32, height: 32 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L3 7L12 12L21 7L12 2Z" fill="#6366f1" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
                    <path d="M3 17L12 22L21 17" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 12L12 17L21 12" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="brand-title" style={{ fontSize: 15 }}>NexusPost</span>
                  <span className="brand-badge">PRO</span>
                </div>
              </div>
              <button
                className="mobile-toggle-btn"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Toggle navigation menu"
              >
                <Menu size={20} />
              </button>
            </header>

            <div className="app-layout">
              <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
              <main className="main-content">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/create" element={<CreatePost />} />
                  <Route path="/schedule" element={<ScheduleHub />} />
                  <Route path="/queue" element={<ScheduleHub initialTab="videos" />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/warmup" element={<WarmUp />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>
            </div>
          </ToastProvider>
        </QueueProvider>
      </LogsProvider>
    </AccountsProvider>
  )
}
