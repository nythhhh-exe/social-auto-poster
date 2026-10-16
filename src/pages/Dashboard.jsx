import { useAccounts } from "../context/AccountsContext"
import { useLogs } from "../context/LogsContext"
import { Users, Send, CheckCircle, TrendingUp, Zap, Clock } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function Dashboard() {
  const { accounts } = useAccounts()
  const { logs } = useLogs()
  const navigate = useNavigate()

  const successCount = logs.filter(l => l.status === "success").length
  const failCount = logs.filter(l => l.status === "error").length
  const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString())

  const stats = [
    { label: "Total Accounts", value: accounts.length, icon: Users, color: "var(--accent)", change: "Connected" },
    { label: "Posts Today", value: todayLogs.length, icon: Send, color: "var(--info)", change: "24h" },
    { label: "Successful Posts", value: successCount, icon: CheckCircle, color: "var(--success)", change: "All time" },
    { label: "Total Posts", value: logs.length, icon: TrendingUp, color: "var(--warning)", change: "All time" },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your automation activity</p>
      </div>

      <div className="stat-grid">
        {stats.map(({ label, value, icon: Icon, color, change }) => (
          <div key={label} className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="stat-label">{label}</div>
                <div className="stat-value">{value}</div>
                <div className="stat-change">{change}</div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={20} color={color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-columns">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Quick Actions</span>
          </div>
          <div className="space-y-3">
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => navigate("/create")}>
              <Zap size={16} /> Create New Post
            </button>
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => navigate("/accounts")}>
              <Users size={16} /> Manage Accounts
            </button>
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => navigate("/history")}>
              <Clock size={16} /> View Post History
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Activity</span>
          </div>
          {logs.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 0" }}>
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">No posts yet</div>
              <p style={{ fontSize: 12 }}>Create your first post to see activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.slice(0, 5).map(log => (
                <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span className={`pill pill-${log.status === "success" ? "success" : "danger"}`}>
                    {log.status === "success" ? "✓" : "✗"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.accountName}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <div className="card-header">
          <span className="card-title">Connected Accounts</span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/accounts")}>Manage</button>
        </div>
        {accounts.length === 0 ? (
          <div className="empty-state" style={{ padding: "20px 0" }}>
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No accounts yet</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>
            {accounts.map(acc => (
              <div key={acc.id} className="account-card">
                <div className="account-avatar">{acc.name[0]}</div>
                <div>
                  <div className="account-name">{acc.name}</div>
                  <div className="account-platform">{acc.username}</div>
                </div>
                <div className="account-status">
                  <div className={`status-dot ${acc.status}`} />
                  <span style={{ color: acc.status === "active" ? "var(--success)" : "var(--danger)", fontSize: 11 }}>
                    {acc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
