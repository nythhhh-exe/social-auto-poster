import { useState, useMemo, useEffect } from "react"
import { useLogs } from "../context/LogsContext"
import { useAccounts } from "../context/AccountsContext"
import { useToast } from "../context/ToastContext"
import {
  Trash2,
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Copy,
  Clock,
  Eye,
  X,
  Send,
  MessageSquare,
  AlertTriangle,
  ChevronDown,
  Activity,
  Layers,
  FileImage,
  FileVideo,
  Loader,
} from "lucide-react"
import axios from "axios"
import { API_BASE } from "../config"

// Format timestamps into readable dates
function formatTime(isoString) {
  if (!isoString) return "—"
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return isoString
  }
}

// Rich Facebook Mockup Preview Modal for Published Posts
function HistoryPreviewModal({ log, onClose, accounts }) {
  if (!log) return null

  const [copied, setCopied] = useState(false)
  const isSuccess = log.status === "success"
  const [photoUrl, setPhotoUrl] = useState(log.mediaPreview || log.mediaUrl || null)
  const [loadingPhoto, setLoadingPhoto] = useState(false)

  // Fetch real photo URL from Facebook Graph API if not cached locally
  useEffect(() => {
    if (log.mediaPreview || log.mediaUrl) {
      setPhotoUrl(log.mediaPreview || log.mediaUrl)
      return
    }
    if (log.postId && accounts?.length > 0) {
      const validToken = accounts.find(a => a.token && a.token !== "browser_session")?.token || localStorage.getItem("sap_master_token")
      if (validToken) {
        setLoadingPhoto(true)
        axios.get(`${API_BASE}/post-media`, {
          params: { post_id: log.postId, token: validToken }
        }).then(res => {
          if (res.data?.url) {
            setPhotoUrl(res.data.url)
            log.mediaPreview = res.data.url
          }
        }).catch(err => {
          console.warn("Could not fetch media for history item:", err)
        }).finally(() => {
          setLoadingPhoto(false)
        })
      }
    }
  }, [log, accounts])

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const postTime = log.scheduledTime
    ? new Date(log.scheduledTime * 1000)
    : new Date(log.timestamp)

  const dateStr = postTime.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560, maxWidth: "95vw" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "var(--radius-xs)",
                background: isSuccess ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isSuccess ? "var(--success)" : "var(--danger)",
              }}
            >
              <Eye size={18} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 className="modal-title" style={{ fontSize: 16 }}>Published Post Preview</h2>
                <span className={`pill pill-${isSuccess ? "success" : "danger"}`} style={{ fontSize: 10.5 }}>
                  {isSuccess ? "Published Live" : "Failed"}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                Published on {dateStr}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Target Pages Badge */}
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Target:</span>
          <span className="platform-badge facebook" style={{ fontSize: 11 }}>
            <span style={{ fontWeight: 800 }}>f</span> {log.accountName || "Facebook Page"}
          </span>
          {log.postId && (
            <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)", marginLeft: "auto" }}>
              ID: {log.postId}
            </span>
          )}
        </div>

        {/* Facebook Mockup Card */}
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          {/* Post Author Bar */}
          <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1877f2, #2563eb)",
                color: "#fff",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
              }}
            >
              {log.accountName?.[0]?.toUpperCase() || "F"}
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>
                {log.accountName || "Facebook Page"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} /> Published {formatTime(log.timestamp)} • {dateStr}
              </div>
            </div>
          </div>

          {/* Caption */}
          {log.caption && (
            <div
              style={{
                padding: "8px 16px 14px",
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {log.caption}
            </div>
          )}

          {/* Media Box: Real Photo / Video */}
          {(photoUrl || log.mediaFilename) && (
            <div
              style={{
                background: "#080c14",
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
                overflow: "hidden",
                textAlign: "center",
                position: "relative",
              }}
            >
              {photoUrl ? (
                <div style={{ position: "relative", width: "100%", maxHeight: 380, display: "flex", alignItems: "center", justifyContent: "center", background: "#05070e" }}>
                  <img
                    src={photoUrl}
                    alt={log.caption || "Post media"}
                    style={{
                      width: "100%",
                      maxHeight: 380,
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                  {log.mediaFilename && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 8,
                        left: 8,
                        background: "rgba(0, 0, 0, 0.75)",
                        backdropFilter: "blur(6px)",
                        color: "#fff",
                        padding: "3px 8px",
                        borderRadius: "var(--radius-xs)",
                        fontSize: 10.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <FileImage size={11} /> {log.mediaFilename}
                    </div>
                  )}
                </div>
              ) : loadingPhoto ? (
                <div style={{ padding: "36px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <Loader size={24} className="spin" color="var(--accent)" />
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    Loading photo from Facebook...
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    padding: "24px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {log.mediaType === "video" ? (
                    <>
                      <FileVideo size={38} style={{ color: "var(--accent)" }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {log.mediaFilename || "Video File"}
                      </div>
                      <span className="pill pill-info" style={{ fontSize: 10 }}>
                        Video Post
                      </span>
                    </>
                  ) : (
                    <>
                      <FileImage size={38} style={{ color: "#38bdf8" }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {log.mediaFilename || "Image Post"}
                      </div>
                      <span className="pill pill-info" style={{ fontSize: 10 }}>
                        Image Post
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Auto Comment Preview */}
          {log.comment && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(99, 102, 241, 0.05)",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", marginBottom: 4 }}>
                💬 Pinned First-Comment
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {log.comment}
              </div>
            </div>
          )}

          {/* Failure Error Trace if exists */}
          {!isSuccess && log.error && (
            <div
              style={{
                padding: "12px 16px",
                background: "var(--danger-soft)",
                borderTop: "1px solid rgba(244, 63, 94, 0.3)",
                color: "#fda4af",
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 4 }}>
                <AlertTriangle size={14} style={{ color: "var(--danger)" }} />
                <span>Error details returned from Meta:</span>
              </div>
              <div style={{ fontFamily: "JetBrains Mono, monospace" }}>{log.error}</div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {log.caption && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopy(log.caption)}
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <Copy size={13} /> {copied ? "Copied" : "Copy Caption"}
              </button>
            )}
            {log.postId && (
              <a
                href={`https://facebook.com/${log.postId}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <ExternalLink size={13} /> View on Facebook
              </a>
            )}
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function History() {
  const { logs, addLog, clearLogs } = useLogs()
  const { accounts } = useAccounts()
  const toast = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // all | success | error
  const [selectedLog, setSelectedLog] = useState(null)

  // Auto-sync any posts that finished publishing from queue into history with accurate publish time
  useEffect(() => {
    try {
      const rawQueue = localStorage.getItem("nexus_post_queue")
      if (!rawQueue) return
      const queueList = JSON.parse(rawQueue)
      if (!Array.isArray(queueList) || queueList.length === 0) return
      const now = Math.floor(Date.now() / 1000)
      let changed = false
      const remaining = []

      queueList.forEach(item => {
        if (item.scheduledTime && (now - item.scheduledTime) >= 30) {
          changed = true
          addLog({
            status: "success",
            accountName: item.targetAccountNames?.join(", ") || "Facebook Page",
            caption: item.caption,
            comment: item.comment,
            mediaType: item.mediaType || "text",
            mediaFilename: item.mediaFilename || "",
            mediaPreview: item.mediaPreview || null,
            mediaUrl: item.mediaPreview || null,
            postId: item.fbPostIds?.[0]?.postId || item.fbPostIds?.[0] || item.id,
            timestamp: new Date(item.scheduledTime * 1000).toISOString(),
            scheduledTime: item.scheduledTime,
          })
        } else {
          remaining.push(item)
        }
      })

      if (changed) {
        localStorage.setItem("nexus_post_queue", JSON.stringify(remaining))
      }
    } catch (err) {
      console.warn("Could not auto-sync queue into history:", err)
    }
  }, [addLog])

  const handleClear = () => {
    if (confirm("Are you sure you want to clear your entire post history?")) {
      clearLogs()
      toast("Post history cleared", "info")
    }
  }

  // Filtered logs calculation
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        (log.caption && log.caption.toLowerCase().includes(q)) ||
        (log.accountName && log.accountName.toLowerCase().includes(q)) ||
        (log.comment && log.comment.toLowerCase().includes(q))

      const matchesStatus = statusFilter === "all" || log.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [logs, searchQuery, statusFilter])

  // Stats calculation
  const totalPosts = logs.length
  const successCount = logs.filter(l => l.status === "success").length
  const failCount = logs.filter(l => l.status === "error").length
  const successRate = totalPosts > 0 ? Math.round((successCount / totalPosts) * 100) : 100

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
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="page-title">Post History</h1>
            <span className="pill pill-info">
              {totalPosts} {totalPosts === 1 ? "Record" : "Records"}
            </span>
          </div>
          <p className="page-subtitle">
            Comprehensive audit log of automated post publications, comments, and delivery statuses.
          </p>
        </div>

        {totalPosts > 0 && (
          <button className="btn btn-danger btn-sm" onClick={handleClear}>
            <Trash2 size={14} /> Clear History
          </button>
        )}
      </div>

      {/* Top Metric Cards */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Dispatched</div>
          <div className="stat-value">{totalPosts}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
            <Layers size={13} /> Across all pages
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Successful Posts</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {successCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--success)", display: "flex", alignItems: "center", gap: 5 }}>
            <CheckCircle2 size={13} /> {successRate}% success rate
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Failed Deliveries</div>
          <div className="stat-value" style={{ color: failCount > 0 ? "var(--danger)" : "var(--text-muted)" }}>
            {failCount}
          </div>
          <div style={{ fontSize: 12, color: failCount > 0 ? "var(--danger)" : "var(--text-muted)" }}>
            {failCount === 0 ? "Zero errors" : "Review failed rows below"}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      {totalPosts > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {/* Search Field */}
          <div className="search-filter-bar" style={{ minWidth: 280, flex: 1, maxWidth: 460 }}>
            <Search size={15} style={{ color: "var(--text-muted)" }} />
            <input
              className="search-filter-input"
              placeholder="Search by caption, account, or comment..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Pills Filter */}
          <div
            style={{
              display: "flex",
              gap: 6,
              background: "var(--bg-secondary)",
              padding: 4,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
            }}
          >
            <button
              onClick={() => setStatusFilter("all")}
              className={`btn btn-sm ${statusFilter === "all" ? "btn-secondary" : "btn-outline"}`}
              style={{ border: "none", padding: "5px 12px" }}
            >
              All ({totalPosts})
            </button>
            <button
              onClick={() => setStatusFilter("success")}
              className={`btn btn-sm ${statusFilter === "success" ? "btn-secondary" : "btn-outline"}`}
              style={{
                border: "none",
                padding: "5px 12px",
                color: statusFilter === "success" ? "var(--success)" : undefined,
              }}
            >
              Published ({successCount})
            </button>
            {failCount > 0 && (
              <button
                onClick={() => setStatusFilter("error")}
                className={`btn btn-sm ${statusFilter === "error" ? "btn-secondary" : "btn-outline"}`}
                style={{
                  border: "none",
                  padding: "5px 12px",
                  color: statusFilter === "error" ? "var(--danger)" : undefined,
                }}
              >
                Failed ({failCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Table Card */}
      {logs.length === 0 ? (
        <div className="card" style={{ padding: "56px 24px" }}>
          <div className="empty-state" style={{ padding: 0 }}>
            <div className="empty-state-icon">
              <Clock size={26} style={{ color: "var(--accent)" }} />
            </div>
            <div className="empty-state-title">No Post History Recorded Yet</div>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 20 }}>
              Whenever you create and publish a post across your pages, activity records will be tracked here.
            </p>
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
          <Search size={28} style={{ opacity: 0.3, marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
            No records matched your search
          </div>
          <p style={{ fontSize: 13, marginTop: 4 }}>Try clearing the search query or status filter.</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Status</th>
                <th style={{ width: 190 }}>Target Page</th>
                <th>Post Caption</th>
                <th style={{ width: 220 }}>Attached Comment</th>
                <th style={{ width: 140 }}>Time</th>
                <th style={{ width: 110, textAlign: "right" }}>Preview</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const isSuccess = log.status === "success"
                const hasComment = Boolean(log.comment)
                const isCommentUrl = hasComment && (log.comment.startsWith("http://") || log.comment.startsWith("https://"))

                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Status Pill */}
                    <td>
                      <span className={`pill pill-${isSuccess ? "success" : "danger"}`}>
                        {isSuccess ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {isSuccess ? "Published" : "Failed"}
                      </span>
                    </td>

                    {/* Target Page */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "var(--radius-xs)",
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
                          {log.accountName ? log.accountName[0]?.toUpperCase() : "F"}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              fontSize: 13.5,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 140,
                            }}
                          >
                            {log.accountName || "Unknown"}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Facebook Page</div>
                        </div>
                      </div>
                    </td>

                    {/* Caption Preview */}
                    <td>
                      <div
                        style={{
                          color: "var(--text-primary)",
                          fontSize: 13.5,
                          maxWidth: 380,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          lineHeight: 1.5,
                        }}
                      >
                        {log.caption || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No caption</span>}
                      </div>
                    </td>

                    {/* Comment Link / Text */}
                    <td onClick={e => e.stopPropagation()}>
                      {hasComment ? (
                        isCommentUrl ? (
                          <a
                            href={log.comment}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              color: "var(--accent)",
                              textDecoration: "none",
                              fontSize: 12.5,
                              fontWeight: 600,
                              background: "var(--accent-soft)",
                              padding: "4px 10px",
                              borderRadius: "var(--radius-full)",
                              maxWidth: 200,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <ExternalLink size={12} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                              {log.comment.replace(/^https?:\/\/(www\.)?/, "")}
                            </span>
                          </a>
                        ) : (
                          <div
                            style={{
                              fontSize: 12.5,
                              color: "var(--text-secondary)",
                              maxWidth: 200,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            💬 {log.comment}
                          </div>
                        )
                      ) : (
                        <span style={{ color: "var(--text-subtle)", fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Date / Relative Time (Scheduled Publication Time) */}
                    <td>
                      {(() => {
                        const effectiveTime = log.scheduledTime
                          ? new Date(log.scheduledTime * 1000).toISOString()
                          : log.timestamp
                        return (
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 12.5 }}>
                              {formatTime(effectiveTime)}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                              {new Date(effectiveTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        )
                      })()}
                    </td>

                    {/* Preview Button */}
                    <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedLog(log)}
                        title="Preview published post"
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", fontSize: 12 }}
                      >
                        <Eye size={13} /> Preview
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rich Facebook Preview Modal */}
      {selectedLog && (
        <HistoryPreviewModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          accounts={accounts}
        />
      )}
    </div>
  )
}
