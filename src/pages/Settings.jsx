import { useState } from "react"
import { useToast } from "../context/ToastContext"
import { useAccounts } from "../context/AccountsContext"
import {
  Save,
  Clock,
  ShieldCheck,
  Server,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Sliders,
  ExternalLink,
  Loader,
  HelpCircle,
  Download,
  Key,
} from "lucide-react"
import axios from "axios"
import { API_BASE } from "../config"

export default function Settings() {
  const toast = useToast()
  const { masterToken } = useAccounts()

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("sap_settings")
    return saved
      ? JSON.parse(saved)
      : {
          defaultDelay: 3,
          defaultComment: "",
          maxRetries: 2,
          randomizeDelay: true,
          facebookAppId: "",
          facebookAppSecret: "",
        }
  })

  const [showSecret, setShowSecret] = useState(false)
  const [testingApi, setTestingApi] = useState(false)
  const [apiHealth, setApiHealth] = useState(null) // { ok: boolean, latency: number, message: string }
  const [hasChanges, setHasChanges] = useState(false)

  const updateSetting = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }))
    setHasChanges(true)
  }

  const handleSave = () => {
    localStorage.setItem("sap_settings", JSON.stringify(settings))
    setHasChanges(false)
    toast("Settings successfully saved!", "success")
  }

  const handleReset = () => {
    if (confirm("Reset all settings to default values?")) {
      const defaults = {
        defaultDelay: 3,
        defaultComment: "",
        maxRetries: 2,
        randomizeDelay: true,
      }
      setSettings(defaults)
      localStorage.setItem("sap_settings", JSON.stringify(defaults))
      setHasChanges(false)
      toast("Settings restored to defaults", "info")
    }
  }

  const testBackendConnection = async () => {
    setTestingApi(true)
    setApiHealth(null)
    const start = performance.now()
    try {
      const res = await axios.get(`${API_BASE}/`, { timeout: 8000 })
      const latency = Math.round(performance.now() - start)
      if (res.data?.status === "ok") {
        setApiHealth({ ok: true, latency, message: `Connected to ${res.data.service || "API"}` })
        toast(`✅ Backend online (${latency}ms)!`, "success")
      } else {
        setApiHealth({ ok: false, latency, message: "Unexpected response format" })
      }
    } catch (err) {
      const latency = Math.round(performance.now() - start)
      setApiHealth({
        ok: false,
        latency,
        message: err.message || "Failed to connect to backend",
      })
      toast("❌ Backend unreachable", "error")
    } finally {
      setTestingApi(false)
    }
  }

  const appendCommentTag = (text) => {
    setSettings(prev => ({
      ...prev,
      defaultComment: prev.defaultComment ? `${prev.defaultComment} ${text}` : text,
    }))
    setHasChanges(true)
  }

  const exportSettings = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2))
    const downloadAnchor = document.createElement("a")
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", "autoposter-settings.json")
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast("Settings exported as JSON", "info")
  }

  return (
    <div>
      {/* Header */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="page-title">Settings</h1>
            {hasChanges && (
              <span className="pill pill-warning" style={{ fontSize: 11 }}>
                Unsaved Changes
              </span>
            )}
          </div>
          <p className="page-subtitle">
            Configure automation pacing, anti-detection delay jitter, comment presets, and cloud connectivity.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleReset} title="Restore factory defaults">
            <RotateCcw size={14} /> Reset Defaults
          </button>
          <button
            className={`btn ${hasChanges ? "btn-primary" : "btn-secondary"}`}
            onClick={handleSave}
            style={{ minWidth: 140 }}
          >
            <Save size={15} /> Save Changes
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {/* Left Column: Automation & Pacing */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Card 1: Pacing & Delivery */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--radius-xs)",
                    background: "var(--accent-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent)",
                  }}
                >
                  <Clock size={16} />
                </div>
                <div>
                  <div className="card-title">Automation & Comment Pacing</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Control delays to protect Facebook accounts</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Comment Delay Stepper */}
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="form-label">Auto-Comment Pacing Delay</label>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "JetBrains Mono, monospace" }}>
                    {settings.defaultDelay} Seconds
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="range"
                    min={1}
                    max={60}
                    value={settings.defaultDelay}
                    onChange={e => updateSetting("defaultDelay", parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--accent)", cursor: "pointer" }}
                  />
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 70, textAlign: "center", padding: "6px 8px" }}
                    min={1}
                    max={120}
                    value={settings.defaultDelay}
                    onChange={e => updateSetting("defaultDelay", parseInt(e.target.value) || 1)}
                  />
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  Interval between the initial post publishing and injecting the first auto-comment.
                </span>
              </div>

              {/* Anti-Detection Jitter Switch */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>
                    Human-Like Delay Jitter (±1.5s)
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                    Varies delay slightly on each post to avoid Meta robotic fingerprinting.
                  </div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.randomizeDelay}
                    onChange={e => updateSetting("randomizeDelay", e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>

              {/* Failure Retries */}
              <div className="form-group">
                <label className="form-label">Network Error Auto-Retries</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[0, 1, 2, 3].map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => updateSetting("maxRetries", count)}
                      className={`btn btn-sm ${settings.maxRetries === count ? "btn-primary" : "btn-secondary"}`}
                      style={{ flex: 1, padding: "8px 0" }}
                    >
                      {count === 0 ? "No Retry" : `${count} ${count === 1 ? "Retry" : "Retries"}`}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  Times the engine will retry a failed upload if Facebook drops the connection.
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Default Comment Template */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--radius-xs)",
                    background: "var(--accent-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent)",
                  }}
                >
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="card-title">Default Comment Template</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Auto-fills in the Create Post screen</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <textarea
                className="form-input"
                style={{ minHeight: 95 }}
                value={settings.defaultComment}
                onChange={e => updateSetting("defaultComment", e.target.value)}
                placeholder="👇 Check this out: https://yourlink.com"
              />

              {/* Quick Append Chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 2 }}>Quick insert:</span>
                {[
                  "👇 Check link:",
                  "🔗 Full article in bio",
                  "📺 Watch complete video:",
                  "⚡ Follow for updates",
                ].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => appendCommentTag(chip)}
                    style={{
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                      borderRadius: "var(--radius-full)",
                      padding: "3px 9px",
                      fontSize: 11,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => {
                      e.target.style.borderColor = "var(--accent)"
                      e.target.style.color = "var(--text-primary)"
                    }}
                    onMouseLeave={e => {
                      e.target.style.borderColor = "var(--border)"
                      e.target.style.color = "var(--text-secondary)"
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: API Status & Best Practices */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Card: Meta App Credentials for 1-Click OAuth */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--radius-xs)",
                    background: "rgba(24, 119, 242, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#1877f2",
                  }}
                >
                  <Key size={16} />
                </div>
                <div>
                  <div className="card-title">Meta App Credentials (1-Click OAuth)</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Enables 1-click connect & permanent tokens</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="form-group">
                <label className="form-label">Facebook App ID</label>
                <input
                  className="form-input"
                  placeholder="e.g. 10482910492810"
                  value={settings.facebookAppId || ""}
                  onChange={e => updateSetting("facebookAppId", e.target.value.trim())}
                />
              </div>

              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="form-label">Facebook App Secret</label>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer" }}
                  >
                    {showSecret ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  className="form-input"
                  type={showSecret ? "text" : "password"}
                  placeholder="e.g. 4a8b9c..."
                  value={settings.facebookAppSecret || ""}
                  onChange={e => updateSetting("facebookAppSecret", e.target.value.trim())}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Stored securely in your local browser storage. Never exposed publicly.
                </span>
              </div>

              <div
                style={{
                  background: "rgba(99, 102, 241, 0.08)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  fontSize: 11.5,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                💡 <strong>Where to find:</strong> Go to{" "}
                <a
                  href="https://developers.facebook.com/apps"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 600 }}
                >
                  Meta for Developers
                </a>{" "}
                → Select your App → <strong>App Settings → Basic</strong>.
              </div>
            </div>
          </div>

          {/* Card 3: Backend API Health & Cloud Connectivity */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--radius-xs)",
                    background: "rgba(16, 185, 129, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--success)",
                  }}
                >
                  <Server size={16} />
                </div>
                <div>
                  <div className="card-title">Backend API Infrastructure</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Target endpoint & service health</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  padding: "12px 14px",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Active API Base URL
                </div>
                <div
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 12.5,
                    color: "var(--text-primary)",
                    marginTop: 4,
                    wordBreak: "break-all",
                  }}
                >
                  {API_BASE}
                </div>
              </div>

              {/* Live Connection Test Output */}
              {apiHealth && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${apiHealth.ok ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
                    background: apiHealth.ok ? "var(--success-soft)" : "var(--danger-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className={`status-dot ${apiHealth.ok ? "active" : "expired"}`} />
                    <span style={{ fontWeight: 600, color: apiHealth.ok ? "#34d399" : "#fda4af" }}>
                      {apiHealth.message}
                    </span>
                  </div>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-muted)" }}>
                    {apiHealth.latency}ms latency
                  </span>
                </div>
              )}

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={testBackendConnection}
                disabled={testingApi}
                style={{ alignSelf: "flex-start" }}
              >
                {testingApi ? <Loader size={13} className="spin" /> : <Zap size={13} />}
                {testingApi ? "Pinging Backend..." : "Test Connection Live"}
              </button>

              {/* Master Token Status */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: 12,
                  borderTop: "1px solid var(--border-subtle)",
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                  <Key size={14} style={{ color: "var(--accent)" }} />
                  <span>Master Access Token:</span>
                </div>
                <span
                  style={{
                    fontWeight: 600,
                    color: masterToken ? "var(--success)" : "var(--text-muted)",
                    fontSize: 11.5,
                  }}
                >
                  {masterToken ? "Saved in LocalStorage" : "Not Set"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Operational Best Practices (Upgraded security card) */}
          <div
            className="card"
            style={{
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(19, 23, 34, 0.8) 100%)",
              borderColor: "rgba(99, 102, 241, 0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ShieldCheck size={18} style={{ color: "var(--accent)" }} />
              <div className="card-title" style={{ fontSize: 14 }}>
                Account Safety & Protection Guidelines
              </div>
            </div>

            <ul style={{ paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>Pacing is Key:</strong> Maintain at least a 2–5
                second delay before posting first comments to look authentic to Facebook.
              </li>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>Token Longevity:</strong> Page Access Tokens generated
                via User Tokens with approved permissions remain active indefinitely unless your password changes.
              </li>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>Proxies:</strong> When executing automated browser
                warm-ups across multiple accounts, configure proxies to prevent Meta IP blocks.
              </li>
            </ul>
          </div>

          {/* Card 5: Configuration Backup & Export */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 18px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                Export Preferences Backup
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                Download a JSON copy of your custom automation settings
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={exportSettings}>
              <Download size={13} /> Export
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
