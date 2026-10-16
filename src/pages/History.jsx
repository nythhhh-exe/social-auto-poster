import { useLogs } from "../context/LogsContext"
import { useToast } from "../context/ToastContext"
import { Trash2, RefreshCw } from "lucide-react"

export default function History() {
  const { logs, clearLogs } = useLogs()
  const toast = useToast()

  const handleClear = () => {
    if (confirm("Clear all post history?")) {
      clearLogs()
      toast("History cleared", "info")
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">Post History</h1>
          <p className="page-subtitle">All your automation posting activity</p>
        </div>
        {logs.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={handleClear}>
            <Trash2 size={14} /> Clear All
          </button>
        )}
      </div>

      <div className="card">
        {logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No post history yet</div>
            <p style={{ fontSize: 13 }}>Your posting activity will appear here</p>
          </div>
        ) : (
          <table className="log-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Account</th>
                <th>Caption Preview</th>
                <th>Comment</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>
                    <span className={`pill pill-${log.status === "success" ? "success" : "danger"}`}>
                      {log.status === "success" ? "✓ Posted" : "✗ Failed"}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{log.accountName}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.caption || "—"}
                  </td>
                  <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--accent)" }}>
                    {log.comment || "—"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
