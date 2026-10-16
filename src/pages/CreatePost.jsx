import { useState, useCallback, useMemo } from "react"
import { useAccounts } from "../context/AccountsContext"
import { useLogs } from "../context/LogsContext"
import { useQueue } from "../context/QueueContext"
import { useToast } from "../context/ToastContext"
import { useNavigate } from "react-router-dom"
import {
  X,
  Send,
  Loader,
  CheckCircle,
  XCircle,
  Image,
  Video,
  CalendarClock,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
  Check,
  ShieldCheck,
  Flame,
  MessageSquare,
  AlertCircle,
} from "lucide-react"
import { useDropzone } from "react-dropzone"
import axios from "axios"
import { API_BASE } from "../config"

// Helper to format Date into datetime-local string
function toLocalDatetimeString(date) {
  const pad = n => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Format date into warm human readable text
function formatHumanTime(date) {
  if (!date || isNaN(date.getTime())) return ""
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

// Calculate remaining time in friendly words
function formatTimeRemaining(targetDate) {
  const diffMs = targetDate.getTime() - Date.now()
  if (diffMs <= 0) return "in a few moments"
  const diffMins = Math.round(diffMs / 60000)
  if (diffMins < 60) return `in ~${diffMins} minutes`
  const diffHours = Math.floor(diffMins / 60)
  const remMins = diffMins % 60
  if (diffHours < 24) {
    return remMins > 0 ? `in ~${diffHours}h ${remMins}m` : `in ~${diffHours} hours`
  }
  const days = Math.floor(diffHours / 24)
  return `in ~${days} day${days > 1 ? "s" : ""}`
}

function AccountSelector({ accounts, selected, onToggle }) {
  const allSelected = accounts.length > 0 && accounts.every(a => selected.includes(a.id))

  const toggleAll = () => {
    if (allSelected) onToggle(null, true)
    else accounts.forEach(a => { if (!selected.includes(a.id)) onToggle(a.id) })
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            Selected: <span style={{ color: "var(--accent)" }}>{selected.length} of {accounts.length}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Which pages will receive this post?</div>
        </div>
        {accounts.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11, padding: "4px 10px" }}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        )}
      </div>

      {accounts.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
          No accounts connected yet. Go to <strong>Accounts</strong> to add your Facebook pages.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
          {accounts.map(acc => {
            const isChecked = selected.includes(acc.id)
            return (
              <div
                key={acc.id}
                onClick={() => onToggle(acc.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: isChecked ? "rgba(99, 102, 241, 0.08)" : "var(--bg-secondary)",
                  border: `1px solid ${isChecked ? "var(--accent)" : "var(--border)"}`,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    border: `1.5px solid ${isChecked ? "var(--accent)" : "var(--border-light)"}`,
                    background: isChecked ? "var(--accent)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                    flexShrink: 0,
                  }}
                >
                  {isChecked && <Check size={13} color="#fff" strokeWidth={3} />}
                </div>

                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #1877f2, #6366f1)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {acc.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {acc.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ID: {acc.pageId}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PostResult({ results }) {
  return (
    <div className="card mt-6">
      <div className="card-header"><span className="card-title">Delivery Status Report</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {results.map(r => (
          <div
            key={r.accountId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${r.status === "success" ? "rgba(16, 185, 129, 0.3)" : r.status === "error" ? "rgba(244, 63, 94, 0.3)" : "var(--border)"}`,
            }}
          >
            {r.status === "success" && <CheckCircle size={18} color="var(--success)" />}
            {r.status === "error" && <XCircle size={18} color="var(--danger)" />}
            {r.status === "pending" && <Loader size={18} className="spin" color="var(--accent)" />}
            <span style={{ fontWeight: 600, fontSize: 13, minWidth: 140 }}>{r.accountName}</span>
            <span style={{ fontSize: 12.5, color: r.status === "error" ? "#fda4af" : "var(--text-secondary)", flex: 1 }}>
              {r.message}
            </span>
            {r.postId && (
              <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                ID: {r.postId}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CreatePost() {
  const { accounts } = useAccounts()
  const { addLog } = useLogs()
  const { addToQueue } = useQueue()
  const toast = useToast()
  const navigate = useNavigate()

  const [caption, setCaption] = useState("")
  const [comment, setComment] = useState("")
  const [delay, setDelay] = useState(3)
  const [media, setMedia] = useState(null)
  const [selectedAccounts, setSelectedAccounts] = useState([])
  const [posting, setPosting] = useState(false)
  const [results, setResults] = useState(null)

  // Timing State: 'instant' or 'scheduled'
  const [timingMode, setTimingMode] = useState("instant")
  const [activePreset, setActivePreset] = useState("+60m")
  const [scheduledDatetime, setScheduledDatetime] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    return toLocalDatetimeString(d)
  })

  // Parsed target date object for friendly countdown & preview
  const scheduledDateObj = useMemo(() => {
    return new Date(scheduledDatetime)
  }, [scheduledDatetime])

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setMedia({ file, url, type: file.type.startsWith("video") ? "video" : "image" })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [], "video/*": [] },
    maxFiles: 1,
  })

  const toggleAccount = (id, clearAll = false) => {
    if (clearAll) { setSelectedAccounts([]); return }
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  // Quick preset shortcuts
  const applyPreset = (presetKey, minutesFromNow, hourOfDay = null) => {
    setActivePreset(presetKey)
    const d = new Date()
    if (hourOfDay !== null) {
      if (presetKey === "tonight") {
        d.setHours(hourOfDay, 0, 0, 0)
        // If 8 PM already passed today, set for tomorrow 8 PM
        if (d.getTime() < Date.now() + 15 * 60 * 1000) {
          d.setDate(d.getDate() + 1)
        }
      } else {
        d.setDate(d.getDate() + 1)
        d.setHours(hourOfDay, 0, 0, 0)
      }
    } else {
      d.setTime(Date.now() + minutesFromNow * 60 * 1000)
    }
    setScheduledDatetime(toLocalDatetimeString(d))
    setTimingMode("scheduled")
  }

  const handlePost = async () => {
    if (!caption.trim()) { toast("Please write a post caption first!", "error"); return }
    if (selectedAccounts.length === 0) { toast("Select at least 1 Facebook Page!", "error"); return }

    let unixTimestamp = null
    if (timingMode === "scheduled") {
      const targetTime = new Date(scheduledDatetime).getTime()
      const now = Date.now()
      const diffMinutes = (targetTime - now) / 60000

      if (diffMinutes < 10) {
        toast("Facebook requires scheduled posts to be at least 10 minutes in the future!", "error")
        return
      }
      unixTimestamp = Math.floor(targetTime / 1000)
    }

    setPosting(true)
    const targetAccounts = accounts.filter(a => selectedAccounts.includes(a.id))

    setResults(targetAccounts.map(acc => ({
      accountId: acc.id,
      accountName: acc.name,
      status: "pending",
      message: timingMode === "scheduled" ? "Registering scheduled post with Facebook..." : "Posting live...",
    })))

    try {
      const formData = new FormData()
      formData.append("caption", caption)
      formData.append("comment", comment)
      formData.append("delay", String(delay))
      formData.append("accounts", JSON.stringify(targetAccounts))
      if (unixTimestamp) {
        formData.append("scheduled_time", String(unixTimestamp))
      }
      if (media?.file) {
        formData.append("media", media.file, media.file.name)
      }

      const { data } = await axios.post(`${API_BASE}/post`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      setResults(data.results)
      if (timingMode === "instant") {
        data.results.forEach(r => addLog({ ...r, caption, comment, mediaPreview: media?.url }))
      }

      const { success, total } = data.summary

      if (timingMode === "scheduled" && success > 0) {
        const fbPostIds = data.results
          .filter(r => r.status === "success" && r.postId)
          .map(r => ({ postId: r.postId, pageId: accounts.find(a => a.id === r.accountId)?.pageId }))

        let mediaPreview = null
        if (media?.file && media.type === "image") {
          try {
            mediaPreview = await new Promise((resolve) => {
              const reader = new FileReader()
              reader.onload = (ev) => {
                const img = new Image()
                img.onload = () => {
                  const canvas = document.createElement("canvas")
                  let w = img.width
                  let h = img.height
                  if (w > 800) {
                    h = Math.round((h * 800) / w)
                    w = 800
                  }
                  canvas.width = w
                  canvas.height = h
                  const ctx = canvas.getContext("2d")
                  ctx.drawImage(img, 0, 0, w, h)
                  resolve(canvas.toDataURL("image/jpeg", 0.82))
                }
                img.onerror = () => resolve(ev.target.result)
                img.src = ev.target.result
              }
              reader.onerror = () => resolve(null)
              reader.readAsDataURL(media.file)
            })
          } catch (e) {
            console.warn("Could not generate thumbnail:", e)
          }
        }

        addToQueue({
          caption,
          comment,
          mediaType: media?.type || "text",
          mediaFilename: media?.file?.name || "",
          mediaPreview,
          targetAccountNames: targetAccounts.map(a => a.name),
          scheduledTime: unixTimestamp,
          fbPostIds,
        })

        toast(`🎉 Successfully queued for ${formatHumanTime(scheduledDateObj)}!`, "success")
      } else if (success === total) {
        toast(`✅ Published to all ${success} accounts!`, "success")
      } else {
        toast(`Published to ${success}/${total} accounts`, "info")
      }

    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Backend error"
      toast(`❌ ${msg}`, "error")
      setResults(prev => prev.map(r => ({ ...r, status: "error", message: msg })))
    }

    setPosting(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 className="page-title">Publish & Schedule</h1>
        <p className="page-subtitle">
          Upload your video or photo once, customize the caption, and publish immediately or schedule into the automation queue.
        </p>
      </div>

      <div className="create-post-layout">
        {/* Left Column: Media & Post Content */}
        <div className="space-y-4">
          {/* STEP 1: Media Dropzone */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="step-badge">1</span>
                <div>
                  <span className="card-title">Upload Video or Photo</span>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Drag and drop media to distribute across pages</div>
                </div>
              </div>
            </div>

            {!media ? (
              <div {...getRootProps()} className={`dropzone${isDragActive ? " active" : ""}`} style={{ padding: "36px 20px" }}>
                <input {...getInputProps()} />
                <div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                  {isDragActive ? "Drop video or photo here!" : "Click or drag your video here"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                  Supports MP4, MOV, WEBM, JPG, PNG • Max size up to Facebook limits
                </div>
                <div style={{ display: "inline-flex", gap: 8, marginTop: 14 }}>
                  <span className="pill pill-default" style={{ fontSize: 11 }}>Reels Ready</span>
                  <span className="pill pill-default" style={{ fontSize: 11 }}>Full HD</span>
                </div>
              </div>
            ) : (
              <div className="media-preview" style={{ borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                {media.type === "image" ? (
                  <img src={media.url} alt="preview" style={{ width: "100%", maxHeight: 280, objectFit: "contain", background: "#000" }} />
                ) : (
                  <video src={media.url} controls style={{ width: "100%", maxHeight: 280, background: "#000" }} />
                )}
                <button
                  className="media-preview-remove"
                  onClick={() => setMedia(null)}
                  title="Remove media"
                >
                  <X size={14} />
                </button>
                <div style={{ padding: "10px 14px", background: "var(--bg-secondary)", fontSize: 12.5, color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {media.type === "image" ? <Image size={15} color="var(--accent)" /> : <Video size={15} color="var(--accent)" />}
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{media.file.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {(media.file.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Caption & Auto Comment */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="step-badge">2</span>
                <div>
                  <span className="card-title">Caption & First Comment</span>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>What viewers see on Facebook</div>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Post Caption *</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{caption.length} chars</span>
              </label>
              <textarea
                className="form-input"
                placeholder="Write your post caption here... Add engaging hooks, description, and hashtags! 🔥"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                style={{ minHeight: 110 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <MessageSquare size={13} color="var(--accent)" />
                <span>Auto-Pinned First Comment (Optional Link Promotion)</span>
              </label>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 8 }}>
                💡 <em>Pro-Tip:</em> Put your TikTok, affiliate, or website link here. Facebook algorithms reward posts that keep external links in the comments instead of the main caption.
              </div>
              <textarea
                className="form-input"
                placeholder="👇 Check the full link here: https://yourwebsite.com/offer"
                value={comment}
                onChange={e => setComment(e.target.value)}
                style={{ minHeight: 65 }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Target Pages, Schedule Mode & Action */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* STEP 3: Target Pages */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="step-badge">3</span>
                <span className="card-title">Target Facebook Pages</span>
              </div>
            </div>
            <AccountSelector accounts={accounts} selected={selectedAccounts} onToggle={toggleAccount} />
          </div>

          {/* STEP 4: When Should This Post? (Super Friendly Timing) */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="step-badge">4</span>
                <div>
                  <span className="card-title">When Should This Post?</span>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Choose immediate release or schedule</div>
                </div>
              </div>
            </div>

            {/* Timing Option Cards */}
            <div className="timing-options-grid" style={{ marginBottom: 16 }}>
              <div
                className={`timing-option-card ${timingMode === "instant" ? "selected" : ""}`}
                onClick={() => setTimingMode("instant")}
              >
                <div className="timing-option-icon">
                  <Send size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>
                    Post Right Now
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    Publishes immediately
                  </div>
                </div>
              </div>

              <div
                className={`timing-option-card ${timingMode === "scheduled" ? "selected" : ""}`}
                onClick={() => setTimingMode("scheduled")}
              >
                <div className="timing-option-icon">
                  <CalendarClock size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>
                    Schedule for Later
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    Queue for future release
                  </div>
                </div>
              </div>
            </div>

            {/* If Scheduled Mode: Show Clean Presets & Datetime */}
            {timingMode === "scheduled" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* One-Click Presets */}
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>
                    ⚡ QUICK RELEASE PRESETS:
                  </div>
                  <div className="preset-chip-group">
                    <button
                      type="button"
                      className={`preset-chip ${activePreset === "+30m" ? "active" : ""}`}
                      onClick={() => applyPreset("+30m", 30)}
                    >
                      <Clock size={12} /> +30 Mins
                    </button>
                    <button
                      type="button"
                      className={`preset-chip ${activePreset === "+60m" ? "active" : ""}`}
                      onClick={() => applyPreset("+60m", 60)}
                    >
                      <Clock size={12} /> +1 Hour
                    </button>
                    <button
                      type="button"
                      className={`preset-chip ${activePreset === "+180m" ? "active" : ""}`}
                      onClick={() => applyPreset("+180m", 180)}
                    >
                      <Clock size={12} /> +3 Hours
                    </button>
                    <button
                      type="button"
                      className={`preset-chip ${activePreset === "tonight" ? "active" : ""}`}
                      onClick={() => applyPreset("tonight", 0, 20)}
                    >
                      🌙 Tonight 8 PM
                    </button>
                    <button
                      type="button"
                      className={`preset-chip ${activePreset === "tmrw_9am" ? "active" : ""}`}
                      onClick={() => applyPreset("tmrw_9am", 0, 9)}
                    >
                      ☀️ Tmrw 9 AM
                    </button>
                    <button
                      type="button"
                      className={`preset-chip ${activePreset === "tmrw_6pm" ? "active" : ""}`}
                      onClick={() => applyPreset("tmrw_6pm", 0, 18)}
                    >
                      🌇 Tmrw 6 PM
                    </button>
                  </div>
                </div>

                {/* Custom Datetime Input */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11.5 }}>
                    Or Pick Custom Date & Exact Time:
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={scheduledDatetime}
                    onChange={e => {
                      setScheduledDatetime(e.target.value)
                      setActivePreset("custom")
                    }}
                  />
                </div>

                {/* Live Readable Confirmation Banner */}
                <div className="schedule-summary-box">
                  <CalendarClock size={24} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                      Scheduled: {formatHumanTime(scheduledDateObj)}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
                      Releasing {formatTimeRemaining(scheduledDateObj)} • Safe Facebook Native Cloud Queue
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Card */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Target Distribution:</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
                  {selectedAccounts.length} Facebook Page{selectedAccounts.length !== 1 ? "s" : ""}
                </div>
              </div>
              {timingMode === "scheduled" && (
                <span className="pill pill-info" style={{ fontSize: 11 }}>
                  Queued Mode
                </span>
              )}
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={handlePost}
              disabled={posting || !caption.trim() || selectedAccounts.length === 0}
            >
              {posting ? (
                <>
                  <Loader size={18} className="spin" />{" "}
                  {timingMode === "scheduled" ? "Registering in Queue..." : "Publishing to Pages..."}
                </>
              ) : timingMode === "scheduled" ? (
                <>
                  <CalendarClock size={18} /> Schedule Video to Queue ({selectedAccounts.length})
                </>
              ) : (
                <>
                  <Send size={18} /> Publish Live Now ({selectedAccounts.length})
                </>
              )}
            </button>

            {/* Helper link to queue */}
            {timingMode === "scheduled" && (
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => navigate("/queue")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  View current scheduled queue →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {results && <PostResult results={results} />}
    </div>
  )
}
