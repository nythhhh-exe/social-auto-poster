import { useState, useEffect } from "react"
import { useToast } from "../context/ToastContext"
import {
  Flame,
  Play,
  Square,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader,
  Key,
  CheckCircle,
  HelpCircle,
  UserPlus,
  Trash2,
  Heart,
  Users,
} from "lucide-react"
import axios from "axios"

import { API_BASE } from "../config"

export default function WarmUp() {
  const toast = useToast()
  const [duration, setDuration] = useState(10) // minutes per admin
  const [headless, setHeadless] = useState(true)
  const [enableReactions, setEnableReactions] = useState(true)

  const [admins, setAdmins] = useState([])
  const [selectedAdminIds, setSelectedAdminIds] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)

  // Add Admin form fields
  const [newAdminName, setNewAdminName] = useState("")
  const [cUser, setCUser] = useState("")
  const [xs, setXs] = useState("")
  const [cookieString, setCookieString] = useState("")
  const [useRawString, setUseRawString] = useState(false)
  const [importingCookie, setImportingCookie] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  const [statusData, setStatusData] = useState({
    isRunning: false,
    status: "idle",
    secondsElapsed: 0,
    totalSeconds: 0,
    postsViewed: 0,
    videosWatched: 0,
    reactionsGiven: 0,
    currentAdminName: "",
    currentAction: "Idle",
    hasProfile: false,
    adminsCount: 0,
  })
  const [loadingAction, setLoadingAction] = useState(false)

  const fetchStatusAndAdmins = async () => {
    try {
      const [statusRes, adminsRes] = await Promise.all([
        axios.get(`${API_BASE}/warmup/status`),
        axios.get(`${API_BASE}/warmup/admins`),
      ])
      setStatusData(statusRes.data)
      const fetchedAdmins = adminsRes.data.admins || []
      setAdmins(fetchedAdmins)

      // Initialize selected if empty
      setSelectedAdminIds((prev) => {
        if (prev.length === 0 && fetchedAdmins.length > 0) {
          return fetchedAdmins.map((a) => a.id)
        }
        return prev
      })
    } catch {
      // Backend might be offline
    }
  }

  useEffect(() => {
    fetchStatusAndAdmins()
    const interval = setInterval(fetchStatusAndAdmins, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleToggleAdmin = (id) => {
    setSelectedAdminIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleSelectAllAdmins = () => {
    if (selectedAdminIds.length === admins.length) {
      setSelectedAdminIds([])
    } else {
      setSelectedAdminIds(admins.map((a) => a.id))
    }
  }

  const handleDeleteAdmin = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm("Remove this Admin account from the warm-up list?")) return
    try {
      await axios.delete(`${API_BASE}/warmup/admins/${id}`)
      toast("🗑️ Admin account removed.", "info")
      fetchStatusAndAdmins()
    } catch (err) {
      toast(`❌ Error: ${err.message}`, "error")
    }
  }

  const handleAddAdmin = async (e) => {
    e.preventDefault()
    if (!useRawString && (!cUser.trim() || !xs.trim())) {
      toast("⚠️ Please enter both c_user and xs values!", "warning")
      return
    }
    if (useRawString && !cookieString.trim()) {
      toast("⚠️ Please paste your cookie string!", "warning")
      return
    }

    setImportingCookie(true)
    try {
      const formData = new FormData()
      formData.append("name", newAdminName.trim())
      if (useRawString) {
        formData.append("cookie_string", cookieString.trim())
      } else {
        formData.append("c_user", cUser.trim())
        formData.append("xs", xs.trim())
      }

      const res = await axios.post(`${API_BASE}/warmup/admins`, formData)
      if (res.data.status === "ok") {
        toast(`✅ ${res.data.message}`, "success")
        setShowAddModal(false)
        setNewAdminName("")
        setCUser("")
        setXs("")
        setCookieString("")
        fetchStatusAndAdmins()
      } else {
        toast(`⚠️ ${res.data.message}`, "warning")
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      toast(`❌ Admin verification failed: ${msg}`, "error")
    } finally {
      setImportingCookie(false)
    }
  }

  const handleStartWarmup = async () => {
    if (selectedAdminIds.length === 0) {
      toast("⚠️ Please select at least one Admin account to warm up!", "warning")
      return
    }

    setLoadingAction(true)
    try {
      const formData = new FormData()
      formData.append("admin_ids", JSON.stringify(selectedAdminIds))
      formData.append("duration", duration)
      formData.append("headless", headless)
      formData.append("enable_reactions", enableReactions)

      await axios.post(`${API_BASE}/warmup/start`, formData)
      toast(
        `🔥 Warm-up started for ${selectedAdminIds.length} Admin(s) (${duration} mins each)!`,
        "success"
      )
      fetchStatusAndAdmins()
    } catch (err) {
      toast(`❌ Failed to start: ${err.message}`, "error")
    } finally {
      setLoadingAction(false)
    }
  }

  const handleStopWarmup = async () => {
    try {
      await axios.post(`${API_BASE}/warmup/stop`)
      toast("⏹️ Warm-up stopped.", "info")
      fetchStatusAndAdmins()
    } catch (err) {
      toast(`❌ Error: ${err.message}`, "error")
    }
  }

  const progressPercent =
    statusData.totalSeconds > 0
      ? Math.min(100, Math.round((statusData.secondsElapsed / statusData.totalSeconds) * 100))
      : 0

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? "0" : ""}${s}`
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Flame size={26} style={{ color: "#ff6b4a" }} /> Multi-Admin Warm-Up (Anti-Ban)
        </h1>
        <p className="page-subtitle">
          Automate scrolling, video watching, and auto-reactions (👍 & ❤️) across multiple Facebook Admin accounts in sequence
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
        {/* Left Column: Multi-Admin & Settings */}
        <div className="space-y-4">
          {/* Card 1: Multi-Admin Management */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={18} style={{ color: "var(--accent)" }} /> Admin Accounts ({admins.length})
              </span>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setShowAddModal(!showAddModal)}
                style={{ gap: 6 }}
              >
                <UserPlus size={13} /> {showAddModal ? "Close Form" : "+ Add Admin"}
              </button>
            </div>

            {/* Add Admin Form (Collapsible) */}
            {showAddModal && (
              <div
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Import Admin via Cookies (No 2FA)</span>
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <HelpCircle size={13} /> {showGuide ? "Hide Steps" : "How to get cookies?"}
                  </button>
                </div>

                {showGuide && (
                  <div style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: 6, padding: "8px 10px", fontSize: 11, lineHeight: 1.5, color: "var(--text-secondary)", marginBottom: 12 }}>
                    <div>1. Open Facebook in Brave with this Admin account.</div>
                    <div>2. Press <b>F12</b> ➜ <b>Application</b> ➜ <b>Cookies</b> ➜ <code>facebook.com</code>.</div>
                    <div>3. Copy <b>c_user</b> and <b>xs</b> values.</div>
                  </div>
                )}

                <form onSubmit={handleAddAdmin} className="space-y-3">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Admin Label / Nickname</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Main Admin, Backup 2..."
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      style={{ fontSize: 12, padding: "8px 10px" }}
                    />
                  </div>

                  {!useRawString ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>c_user</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="1000..."
                          value={cUser}
                          onChange={(e) => setCUser(e.target.value)}
                          style={{ fontSize: 12, padding: "8px 10px" }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>xs</label>
                        <input
                          type="password"
                          className="form-input"
                          placeholder="Session token..."
                          value={xs}
                          onChange={(e) => setXs(e.target.value)}
                          style={{ fontSize: 12, padding: "8px 10px" }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 11 }}>Raw Cookie String</label>
                      <textarea
                        className="form-input"
                        rows={2}
                        placeholder="c_user=...; xs=...;"
                        value={cookieString}
                        onChange={(e) => setCookieString(e.target.value)}
                        style={{ fontSize: 11, fontFamily: "monospace", padding: "8px 10px" }}
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => setUseRawString(!useRawString)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
                    >
                      {useRawString ? "Switch to fields" : "Paste raw header"}
                    </button>
                    <button
                      type="submit"
                      disabled={importingCookie}
                      className="btn btn-primary btn-sm"
                      style={{ gap: 6 }}
                    >
                      {importingCookie ? <Loader size={13} className="spin" /> : <CheckCircle size={13} />}
                      {importingCookie ? "Verifying..." : "Add Admin"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Admin Accounts List */}
            {admins.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 10px", color: "var(--text-muted)", fontSize: 13 }}>
                No Admin accounts added yet. Click <b>+ Add Admin</b> to import your first Admin via cookies!
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>Select accounts to warm up in this batch:</span>
                  <button
                    type="button"
                    onClick={handleSelectAllAdmins}
                    style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                  >
                    {selectedAdminIds.length === admins.length ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div className="space-y-2">
                  {admins.map((adm) => {
                    const isSelected = selectedAdminIds.includes(adm.id)
                    return (
                      <div
                        key={adm.id}
                        onClick={() => handleToggleAdmin(adm.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: 6,
                          background: isSelected ? "rgba(99, 102, 241, 0.12)" : "var(--bg-secondary)",
                          border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleAdmin(adm.id)}
                            style={{ cursor: "pointer", width: 15, height: 15 }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                              {adm.name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              ID: {adm.c_user} • Last active: {adm.lastWarmedUp || "Never"}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteAdmin(adm.id, e)}
                          className="btn btn-sm btn-icon"
                          style={{ color: "var(--text-muted)", padding: 4 }}
                          title="Remove admin"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Warm-up Settings & Auto-Reactions */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: 16 }}>Batch Settings & Human Reactions</h2>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Duration per Admin Account</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[5, 10, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDuration(mins)}
                    disabled={statusData.isRunning}
                    className={`btn btn-sm ${duration === mins ? "btn-primary" : "btn-secondary"}`}
                    style={{ flex: 1 }}
                  >
                    {mins} mins
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-Reactions Toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                background: enableReactions ? "rgba(239, 68, 68, 0.08)" : "var(--bg-secondary)",
                border: `1px solid ${enableReactions ? "rgba(239, 68, 68, 0.3)" : "var(--border)"}`,
                borderRadius: 8,
                marginBottom: 16,
                cursor: "pointer",
              }}
              onClick={() => setEnableReactions(!enableReactions)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Heart size={18} style={{ color: enableReactions ? "#ff4d6d" : "var(--text-muted)" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    Auto-React to Posts & Media (👍 Like & ❤️ Love)
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    Gives natural likes & loves to random posts while scrolling to build high trust
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableReactions}
                onChange={() => setEnableReactions(!enableReactions)}
                style={{ width: 17, height: 17, cursor: "pointer" }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Display Mode</label>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setHeadless(true)}
                  disabled={statusData.isRunning}
                  className={`btn btn-sm ${headless ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1, gap: 6 }}
                >
                  <EyeOff size={14} /> Invisible (Background)
                </button>
                <button
                  type="button"
                  onClick={() => setHeadless(false)}
                  disabled={statusData.isRunning}
                  className={`btn btn-sm ${!headless ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1, gap: 6 }}
                >
                  <Eye size={14} /> Visible Window
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {!statusData.isRunning ? (
                <button
                  className="btn btn-primary"
                  onClick={handleStartWarmup}
                  disabled={loadingAction || selectedAdminIds.length === 0}
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    padding: "12px",
                    background: "linear-gradient(135deg, #ff6b4a, #ff8f70)",
                  }}
                >
                  {loadingAction ? <Loader size={16} className="spin" /> : <Play size={16} />}
                  Start Warm-Up ({selectedAdminIds.length} Admins)
                </button>
              ) : (
                <button
                  className="btn btn-danger"
                  onClick={handleStopWarmup}
                  style={{ flex: 1, justifyContent: "center", padding: "12px" }}
                >
                  <Square size={16} /> Stop Warm-Up
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Progress & Human Simulation Monitor */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <span className="card-title">Live Activity Monitor</span>
            {statusData.isRunning && (
              <span className="pill pill-success" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="status-dot active" /> Running: {statusData.currentAdminName}
              </span>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
              <span>Total Batch Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="progress-bar" style={{ height: 6 }}>
              <div
                className="progress-fill"
                style={{
                  width: `${progressPercent}%`,
                  background: "linear-gradient(90deg, #ff6b4a, #ffaa88)",
                }}
              />
            </div>
          </div>

          <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div className="stat-card" style={{ padding: "14px" }}>
              <div className="stat-label">Elapsed Time</div>
              <div className="stat-value" style={{ fontSize: 20 }}>
                {formatTime(statusData.secondsElapsed)} / {formatTime(statusData.totalSeconds)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: "14px" }}>
              <div className="stat-label">Posts Viewed</div>
              <div className="stat-value" style={{ fontSize: 20, color: "var(--accent)" }}>
                {statusData.postsViewed}
              </div>
            </div>
            <div className="stat-card" style={{ padding: "14px" }}>
              <div className="stat-label">Videos Watched</div>
              <div className="stat-value" style={{ fontSize: 20, color: "var(--success)" }}>
                {statusData.videosWatched}
              </div>
            </div>
            <div className="stat-card" style={{ padding: "14px" }}>
              <div className="stat-label">Reactions Given (👍/❤️)</div>
              <div className="stat-value" style={{ fontSize: 20, color: "#ff4d6d" }}>
                {statusData.reactionsGiven || 0}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "auto",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-sm)",
              padding: 14,
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Current Action
            </div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
              {statusData.isRunning && <Loader size={14} className="spin" style={{ color: "#ff6b4a" }} />}
              {statusData.currentAction}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
