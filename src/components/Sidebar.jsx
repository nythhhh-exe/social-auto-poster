import { NavLink } from "react-router-dom"
import { LayoutDashboard, Send, Users, History, Settings, Flame } from "lucide-react"
import { useAccounts } from "../context/AccountsContext"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/create", icon: Send, label: "Create Post" },
  { to: "/accounts", icon: Users, label: "Accounts" },
  { to: "/warmup", icon: Flame, label: "Admin Warm-Up" },
  { to: "/history", icon: History, label: "Post History" },
  { to: "/settings", icon: Settings, label: "Settings" },
]

export default function Sidebar() {
  const { accounts } = useAccounts()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">⚡</div>
        <span className="sidebar-logo-text">AutoPoster</span>
      </div>
      <div className="sidebar-section-label">Navigation</div>
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          end={to === "/"}
        >
          <Icon size={16} />
          {label}
          {label === "Accounts" && accounts.length > 0 && (
            <span className="badge">{accounts.length}</span>
          )}
        </NavLink>
      ))}
      <div style={{ marginTop: "auto", padding: "12px", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {accounts.filter(a => a.status === "active").length} accounts active
          </span>
        </div>
      </div>
    </aside>
  )
}
