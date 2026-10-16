import { useState } from "react"
import { useToast } from "../context/ToastContext"
import { Save } from "lucide-react"

export default function Settings() {
  const toast = useToast()
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("sap_settings")
    return saved ? JSON.parse(saved) : {
      defaultDelay: 3,
      defaultComment: "",
      maxRetries: 2,
      randomizeDelay: true,
    }
  })

  const handleSave = () => {
    localStorage.setItem("sap_settings", JSON.stringify(settings))
    toast("Settings saved!", "success")
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your automation preferences</p>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-header"><span className="card-title">⚙️ Automation Settings</span></div>
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Default Comment Delay (seconds)</label>
            <input
              type="number"
              className="form-input"
              value={settings.defaultDelay}
              onChange={e => setSettings(p => ({ ...p, defaultDelay: parseInt(e.target.value) }))}
              min={1} max={120}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Seconds to wait before adding the auto-comment</span>
          </div>

          <div className="form-group">
            <label className="form-label">Default Comment Template</label>
            <textarea
              className="form-input"
              value={settings.defaultComment}
              onChange={e => setSettings(p => ({ ...p, defaultComment: e.target.value }))}
              placeholder="👇 Check this out: https://yourlink.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Max Retries on Failure</label>
            <input
              type="number"
              className="form-input"
              value={settings.maxRetries}
              onChange={e => setSettings(p => ({ ...p, maxRetries: parseInt(e.target.value) }))}
              min={0} max={5}
            />
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.randomizeDelay}
              onChange={e => setSettings(p => ({ ...p, randomizeDelay: e.target.checked }))}
            />
            Randomize delay slightly (±1s) to appear more human
          </label>

          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={14} /> Save Settings
          </button>
        </div>
      </div>

      <div className="card mt-6" style={{ maxWidth: 560, borderColor: "var(--warning)", background: "var(--warning-soft)" }}>
        <div className="card-title" style={{ marginBottom: 8 }}>⚠️ Important Note</div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
          This tool is for automation of your own Facebook Pages only. 
          Always use valid Page Access Tokens. Using expired or invalid tokens 
          will cause posts to fail. Rotate proxies per account to avoid rate limiting.
        </p>
      </div>
    </div>
  )
}
