import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import {
  CalendarClock,
  Film,
  Flame,
  Clock,
  Save,
  Loader,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Users,
  Heart,
  EyeOff,
  Square,
} from "lucide-react"
import axios from "axios"
import Queue from "./Queue"
import { useQueue } from "../context/QueueContext"
import { useToast } from "../context/ToastContext"
import { API_BASE } from "../config"

export default function ScheduleHub({ initialTab = "videos" }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabQuery = searchParams.get("tab")
  const { queue } = useQueue()
  const toast = useToast()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState(
    tabQuery === "scroll" || tabQuery === "videos"
      ? tabQuery
      : initialTab || "videos"
  )

  // Scroll Schedule State
  const [scheduleConfig, setScheduleConfig] = useState({
    enabled: false,
    time: "09:00",
    frequency: "daily",
    duration_minutes: 10,
    headless: true,
    enable_reactions: true,
    admin_ids: ["all"],
    last_run: null,
    nextRun: null,
  })
  const [admins, setAdmins] = useState([])
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  // Live warmup engine state
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
  })

  const fetchLiveStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/warmup/status`)
      if (res.data) {
        setStatusData(res.data)
        // Only sync nextRun and last_run, do NOT overwrite user's edited form fields!
        if (res.data.schedule) {
          setScheduleConfig((prev) => ({
            ...prev,
            nextRun: res.data.schedule.nextRun,
            last_run: res.data.schedule.last_run,
            last_run_date: res.data.schedule.last_run_date,
          }))
        }
      }
    } catch {
      // Backend offline
    }
  }

  const handleStopWarmup = async () => {
    try {
      await axios.post(`${API_BASE}/warmup/stop`)
      toast("⏹️ Auto-warmup stopped.", "info")
      fetchLiveStatus()
    } catch (err) {
      toast(`❌ Error stopping: ${err.message}`, "error")
    }
  }

  const fetchScheduleAndAdmins = async () => {
    try {
      setLoadingSchedule(true)
      const [schedRes, adminsRes] = await Promise.all([
        axios.get(`${API_BASE}/warmup/schedule`),
        axios.get(`${API_BASE}/warmup/admins`),
      ])
      if (schedRes.data) setScheduleConfig(schedRes.data)
      if (adminsRes.data?.admins) setAdmins(adminsRes.data.admins)
    } catch {
      // Backend offline
    } finally {
      setLoadingSchedule(false)
    }
  }

  useEffect(() => {
    fetchScheduleAndAdmins()
    fetchLiveStatus()
    const timer = setInterval(fetchLiveStatus, 2000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (tabQuery && (tabQuery === "scroll" || tabQuery === "videos") && tabQuery !== activeTab) {
      setActiveTab(tabQuery)
    }
  }, [tabQuery])

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey)
    setSearchParams({ tab: tabKey }, { replace: true })
  }

  const isAccountSelected = (adminId) => {
    if (!scheduleConfig.admin_ids || scheduleConfig.admin_ids.includes("all")) {
      return true
    }
    return Array.isArray(scheduleConfig.admin_ids) && scheduleConfig.admin_ids.includes(adminId)
  }

  const getSelectedAdminIds = () => {
    if (!scheduleConfig.admin_ids || scheduleConfig.admin_ids.includes("all")) {
      return admins.map((a) => a.id)
    }
    return scheduleConfig.admin_ids
  }

  const handleToggleAccount = (adminId) => {
    let current =
      !scheduleConfig.admin_ids || scheduleConfig.admin_ids.includes("all")
        ? admins.map((a) => a.id)
        : [...scheduleConfig.admin_ids]

    let updated
    if (current.includes(adminId)) {
      updated = current.filter((id) => id !== adminId)
    } else {
      updated = [...current, adminId]
    }
    setScheduleConfig({ ...scheduleConfig, admin_ids: updated })
  }

  const isAllSelected = admins.length > 0 && admins.every((a) => isAccountSelected(a.id))

  const handleToggleAll = () => {
    if (isAllSelected) {
      setScheduleConfig({ ...scheduleConfig, admin_ids: [] })
    } else {
      setScheduleConfig({ ...scheduleConfig, admin_ids: admins.map((a) => a.id) })
    }
  }

  const selectedCount = admins.filter((a) => isAccountSelected(a.id)).length

  const handleSaveSchedule = async (customConfig) => {
    const payload = customConfig || scheduleConfig
    const effectiveSelected = payload.admin_ids?.includes("all")
      ? admins.map((a) => a.id)
      : payload.admin_ids || []

    if (payload.enabled && effectiveSelected.length === 0) {
      toast("⚠️ Please select at least one Admin account for the auto-scroll schedule!", "warning")
      return
    }

    setSavingSchedule(true)
    try {
      const res = await axios.post(`${API_BASE}/warmup/schedule`, payload)
      setScheduleConfig(res.data)
      toast(
        payload.enabled
          ? `⏰ Auto-Scroll Schedule active for ${effectiveSelected.length} Admin(s)! Next run: ${res.data.nextRun || res.data.time}`
          : "⏹️ Auto-Scroll Schedule disabled.",
        "success"
      )
    } catch (err) {
      toast(`❌ Failed to save schedule: ${err.message}`, "error")
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleToggleScheduleEnabled = () => {
    const updated = { ...scheduleConfig, enabled: !scheduleConfig.enabled }
    setScheduleConfig(updated)
    handleSaveSchedule(updated)
  }

  const formatScheduleNextRun = (nextRunStr) => {
    if (!nextRunStr) return null
    try {
      const d = new Date(nextRunStr.replace(" ", "T"))
      const now = new Date()
      const diffMs = d.getTime() - now.getTime()
      if (diffMs <= 0) return "Starting soon"
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      const timePart = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      const isToday = d.toDateString() === now.toDateString()
      const dayPart = isToday ? "Today" : "Tomorrow"
      return `${dayPart} at ${timePart} (in ${diffHours > 0 ? `${diffHours}h ` : ""}${diffMins}m)`
    } catch {
      return nextRunStr
    }
  }

  return (
    <div>
      {/* Schedule Center Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CalendarClock size={26} style={{ color: "var(--accent)" }} /> Schedule Center
              </h1>
              <span className="brand-badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent)" }}>
                AUTOMATION
              </span>
            </div>
            <p className="page-subtitle">
              {activeTab === "videos"
                ? "Manage scheduled video & post releases registered in Facebook cloud queue"
                : "Configure automated daily feed warm-up and human scrolling across Facebook Admin accounts"}
            </p>
          </div>
        </div>

        {/* Dual Top Tabs */}
        <div className="schedule-nav-tabs">
          <button
            type="button"
            className={`schedule-nav-tab ${activeTab === "videos" ? "active" : ""}`}
            onClick={() => handleTabChange("videos")}
          >
            <Film size={16} />
            <span>Queued Videos</span>
            {queue.length > 0 && (
              <span className="badge" style={{ fontSize: 11, padding: "2px 7px" }}>
                {queue.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`schedule-nav-tab ${activeTab === "scroll" ? "active" : ""}`}
            onClick={() => handleTabChange("scroll")}
          >
            <Flame size={16} style={{ color: activeTab === "scroll" || statusData.isRunning ? "#ff6b4a" : undefined }} />
            <span>Scroll Schedule</span>
            {statusData.isRunning ? (
              <span className="pill pill-success" style={{ fontSize: 10, padding: "2px 6px" }}>
                Running
              </span>
            ) : scheduleConfig.enabled ? (
              <span className="status-dot active" style={{ width: 7, height: 7 }} />
            ) : null}
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === "videos" && <Queue embed={true} />}

      {activeTab === "scroll" && (
        <div>
          {/* Live In-Progress Activity Alert Banner */}
          {statusData.isRunning && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(255, 107, 74, 0.16), rgba(255, 143, 112, 0.08))",
                border: "1px solid rgba(255, 107, 74, 0.4)",
                borderRadius: 10,
                padding: "14px 18px",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                boxShadow: "0 4px 20px rgba(255, 107, 74, 0.15)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Flame size={24} style={{ color: "#ff6b4a" }} />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    <span>Auto-Warmup Is Active & Scrolling Now:</span>
                    <span className="pill pill-success" style={{ fontSize: 11 }}>{statusData.currentAdminName}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {statusData.currentAction} • {statusData.postsViewed} posts viewed • {statusData.videosWatched} videos watched • {statusData.reactionsGiven} reactions given
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate("/warmup")}
                  style={{ gap: 5, fontSize: 11 }}
                >
                  <ExternalLink size={12} /> Live Monitor
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleStopWarmup}
                  style={{ gap: 5, fontSize: 11 }}
                >
                  <Square size={12} /> Stop
                </button>
              </div>
            </div>
          )}

          <div className="schedule-hub-grid">
            {/* Column 1: The Automated Schedule Card */}
            <div className="card">
              <div className="card-header" style={{ marginBottom: 14 }}>
                <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={18} style={{ color: "#38bdf8" }} /> Automated Schedule
                </span>
                <button
                  type="button"
                  className={`btn btn-sm ${scheduleConfig.enabled ? "btn-success" : "btn-secondary"}`}
                  onClick={handleToggleScheduleEnabled}
                  disabled={savingSchedule}
                  style={{ gap: 6, fontWeight: 600, fontSize: 12, padding: "5px 12px" }}
                >
                  {scheduleConfig.enabled ? (
                    <>
                      <span className="status-dot active" style={{ width: 8, height: 8 }} />
                      Schedule ON
                    </>
                  ) : (
                    <>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)", display: "inline-block" }} />
                      Schedule OFF
                    </>
                  )}
                </button>
              </div>

              {/* Next Run Info Banner */}
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 16,
                  background: statusData.isRunning
                    ? "rgba(255, 107, 74, 0.1)"
                    : scheduleConfig.enabled
                    ? "rgba(56, 189, 248, 0.08)"
                    : "var(--bg-secondary)",
                  border: `1px solid ${
                    statusData.isRunning
                      ? "rgba(255, 107, 74, 0.3)"
                      : scheduleConfig.enabled
                      ? "rgba(56, 189, 248, 0.25)"
                      : "var(--border)"
                  }`,
                  fontSize: 12,
                }}
              >
                {statusData.isRunning ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ff8f70", fontWeight: 600 }}>
                      <span className="status-dot active" style={{ width: 8, height: 8, background: "#ff6b4a" }} />
                      <span>Auto-Warmup cycle in progress ({statusData.currentAdminName})</span>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                      {statusData.postsViewed} posts viewed
                    </span>
                  </div>
                ) : scheduleConfig.enabled ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div>
                      <span style={{ color: "#38bdf8", fontWeight: 600 }}>⏰ Next Auto Warm-Up: </span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                        {formatScheduleNextRun(scheduleConfig.nextRun) || "Scheduled"}
                      </span>
                    </div>
                    {scheduleConfig.last_run && (
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        Last run: {scheduleConfig.last_run}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ color: "var(--text-muted)" }}>
                    Turn on to automatically run background warm-ups daily without having to manually open and click.
                  </div>
                )}
              </div>

            {/* Frequency Selector */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Frequency</label>
              <div className="schedule-freq-grid">
                {[
                  { id: "daily", label: "Daily (Fixed)" },
                  { id: "every_12h", label: "Every 12 Hours" },
                  { id: "every_6h", label: "Every 6 Hours" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setScheduleConfig({ ...scheduleConfig, frequency: f.id })}
                    className={`btn btn-sm ${scheduleConfig.frequency === f.id ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: 11, padding: "7px 4px", justifyContent: "center" }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Picker (Only shown when daily is selected) */}
            {scheduleConfig.frequency === "daily" && (
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Run Every Day At</label>
                <input
                  type="time"
                  className="form-input"
                  value={scheduleConfig.time || "09:00"}
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, time: e.target.value })}
                  style={{ fontSize: 13, padding: "8px 12px", width: "100%", maxWidth: 180 }}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                  Runs automatically in the background at this time every day.
                </span>
              </div>
            )}

            {/* Duration per Admin for Schedule */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Scheduled Duration per Admin</label>
              <div className="schedule-duration-grid">
                {[5, 10, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setScheduleConfig({ ...scheduleConfig, duration_minutes: mins })}
                    className={`btn btn-sm ${scheduleConfig.duration_minutes === mins ? "btn-primary" : "btn-secondary"}`}
                    style={{ flex: 1, minWidth: 50, fontSize: 11 }}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Scheduled Options: Background + Reactions styled as matching pill toggle buttons */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Run Settings & Behaviors</label>
              <div className="schedule-behavior-grid">
                <button
                  type="button"
                  onClick={() => setScheduleConfig({ ...scheduleConfig, headless: !scheduleConfig.headless })}
                  className={`btn btn-sm ${scheduleConfig.headless ? "btn-primary" : "btn-secondary"}`}
                  style={{ gap: 6, justifyContent: "center", padding: "8px 12px", fontSize: 12 }}
                >
                  <EyeOff size={14} /> Invisible (Headless)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setScheduleConfig({ ...scheduleConfig, enable_reactions: !scheduleConfig.enable_reactions })
                  }
                  className={`btn btn-sm ${scheduleConfig.enable_reactions ? "btn-primary" : "btn-secondary"}`}
                  style={{ gap: 6, justifyContent: "center", padding: "8px 12px", fontSize: 12 }}
                >
                  <Heart size={14} style={{ color: scheduleConfig.enable_reactions ? "#fff" : "var(--text-muted)" }} />
                  Auto-Reactions
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleSaveSchedule()}
              disabled={savingSchedule}
              style={{ width: "100%", justifyContent: "center", gap: 6, padding: "10px" }}
            >
              {savingSchedule ? <Loader size={13} className="spin" /> : <Save size={13} />}
              Save Schedule Settings
            </button>
          </div>

          {/* Column 2: Scheduled Enrolled Accounts & Info */}
          <div className="space-y-4">
            <div className="card">
              <div className="card-header" style={{ marginBottom: 12 }}>
                <div>
                  <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <Users size={16} style={{ color: "var(--accent)" }} /> Accounts to Auto-Scroll ({selectedCount}/{admins.length})
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => navigate("/warmup")}
                    style={{ gap: 5, fontSize: 11 }}
                  >
                    <ExternalLink size={12} /> Live Warm-Up
                  </button>
                </div>
              </div>

              {admins.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "14px 0", textAlign: "center" }}>
                  No Admin accounts found. Visit <b>Admin Warm-Up</b> to import cookies for accounts.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span>Tick accounts to include in auto-scroll:</span>
                    <button
                      type="button"
                      onClick={handleToggleAll}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent)",
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {isAllSelected ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {admins.map((adm) => {
                      const selected = isAccountSelected(adm.id)
                      return (
                        <div
                          key={adm.id}
                          onClick={() => handleToggleAccount(adm.id)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 6,
                            background: selected ? "rgba(99, 102, 241, 0.12)" : "var(--bg-secondary)",
                            border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => handleToggleAccount(adm.id)}
                              style={{ cursor: "pointer", width: 16, height: 16 }}
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
                          <span
                            className={`pill ${selected ? "pill-success" : "pill-muted"}`}
                            style={{
                              fontSize: 10,
                              background: selected ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                              color: selected ? "#34d399" : "var(--text-muted)",
                            }}
                          >
                            {selected ? "Active" : "Skipped"}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {admins.length > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 12px",
                    background: selectedCount > 0 ? "rgba(99, 102, 241, 0.08)" : "rgba(244, 63, 94, 0.08)",
                    border: `1px solid ${selectedCount > 0 ? "rgba(99, 102, 241, 0.2)" : "rgba(244, 63, 94, 0.2)"}`,
                    borderRadius: 6,
                    fontSize: 11.5,
                    color: "var(--text-secondary)",
                  }}
                >
                  {selectedCount > 0 ? (
                    <div>
                      ⏱️ <b>Batch Estimate:</b> {selectedCount} of {admins.length} Admin(s) ×{" "}
                      {scheduleConfig.duration_minutes || 10}m ={" "}
                      <b style={{ color: "var(--text-primary)" }}>
                        {selectedCount * (scheduleConfig.duration_minutes || 10)} mins total
                      </b>{" "}
                      per scheduled cycle.
                    </div>
                  ) : (
                    <div style={{ color: "#f87171" }}>
                      ⚠️ No accounts selected. Please tick at least one account to run on schedule.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card" style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <ShieldCheck size={18} style={{ color: "var(--success)" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                  Anti-Ban Sequential Queue
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                When triggered, accounts are warmed up <b>one-by-one in sequence</b> with a 10-second cool-down between each account. This keeps your device memory light and protects all accounts from simultaneous detection.
              </p>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
