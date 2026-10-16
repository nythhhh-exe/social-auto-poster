import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  Send,
  CalendarClock,
  Users,
  History,
  Settings,
  Flame,
  Zap,
  X,
} from "lucide-react"
import { useAccounts } from "../context/AccountsContext"
import { useQueue } from "../context/QueueContext"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/create", icon: Send, label: "Create Post" },
  { to: "/schedule", icon: CalendarClock, label: "Schedule Center" },
  { to: "/accounts", icon: Users, label: "Accounts" },
  { to: "/warmup", icon: Flame, label: "Admin Warm-Up" },
  { to: "/history", icon: History, label: "Post History" },
  { to: "/settings", icon: Settings, label: "Settings" },
]

export default function Sidebar({ mobileOpen = false, onClose }) {
  const { accounts } = useAccounts()
  const { queue } = useQueue()
  const activeCount = accounts.filter(a => a.status === "active").length

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className={`sidebar-backdrop ${mobileOpen ? "active" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        {/* Brand Header */}
        <div className="sidebar-logo" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="brand-emblem-container">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7L12 12L21 7L12 2Z" fill="url(#brand-grad1)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
                <path d="M3 17L12 22L21 17" stroke="url(#brand-grad2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 12L12 17L21 12" stroke="url(#brand-grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="brand-grad1" x1="3" y1="2" x2="21" y2="12" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366f1" />
                    <stop offset="1" stopColor="#a855f7" />
                  </linearGradient>
                  <linearGradient id="brand-grad2" x1="3" y1="17" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38bdf8" />
                    <stop offset="1" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="brand-title">NexusPost</span>
                <span className="brand-badge">PRO</span>
              </div>
              <span className="brand-subtitle">AUTONOMOUS ENGINE</span>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-outline btn-sm mobile-close-btn"
              style={{ padding: 4, border: "none", color: "var(--text-muted)" }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="sidebar-section-label">Platform</div>

        {/* Navigation Links */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              end={to === "/"}
              onClick={() => {
                if (onClose) onClose()
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
              {label === "Accounts" && accounts.length > 0 && (
                <span className="badge">{accounts.length}</span>
              )}
              {label === "Schedule Center" && queue.length > 0 && (
                <span className="badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", borderColor: "rgba(16, 185, 129, 0.4)" }}>
                  {queue.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* System Status Footer */}
        <div
          style={{
            marginTop: "auto",
            padding: "14px 12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Engine Status
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="status-dot active" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--success)" }}>Online</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Active Pages</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
              {activeCount} / {accounts.length}
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
