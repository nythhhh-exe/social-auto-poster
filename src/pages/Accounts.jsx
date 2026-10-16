import { useState, useMemo, useEffect, useRef } from "react"
import { useAccounts } from "../context/AccountsContext"
import { useToast } from "../context/ToastContext"
import {
  Plus,
  Trash2,
  X,
  Check,
  ShieldCheck,
  ShieldAlert,
  Loader,
  Zap,
  Layers,
  RefreshCw,
  Search,
  Copy,
  ExternalLink,
  Users as UsersIcon,
  Globe,
  Radio,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Info,
  Key,
  Sparkles,
} from "lucide-react"
import axios from "axios"
import { API_BASE } from "../config"

// Helper to format follower counts (e.g. 14,200 -> 14.2K)
function formatNumber(num) {
  if (!num && num !== 0) return "?"
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M"
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K"
  return num.toLocaleString()
}

// Notification phrases that should never be treated as Facebook Pages
export const NOTIFICATION_KEYWORDS = [
  "notification",
  "notifications",
  "unread",
  "tagged",
  "has new views",
  "new views",
  "reel is ready",
  "your reel",
  "commented",
  "liked your",
  "shared your",
  "friend request",
  "view reel",
  "views.",
  "in a post",
  "mentioned you",
  "replied to",
  "started following",
  "invited you",
  "shared a link",
  "has 6",
  "has 5",
  "has 4",
  "has 3",
  "has 2",
  "has 1",
]

export function isNotificationItem(account) {
  if (!account) return false
  const name = (account.name || "").toLowerCase().trim()
  return (
    name.startsWith("unread") ||
    name === "notifications" ||
    name === "pages" ||
    NOTIFICATION_KEYWORDS.some(k => name.includes(k))
  )
}

/* ==========================================================================
   EASY CONNECT MODAL: DIRECT BROWSER LOGIN (ZERO DEV SETUP)
   ========================================================================== */
function FacebookLoginModal({ onClose, onImport, existingPageIds }) {
  // Browser Login State
  const [browserStatus, setBrowserStatus] = useState("idle") // idle | opening | waiting_login | extracting | success | error
  const [browserMessage, setBrowserMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetchedPages, setFetchedPages] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState("")

  // IN-APP BROWSER WINDOW LOGIN
  const startBrowserLogin = async () => {
    setLoading(true)
    setError("")
    setBrowserMessage("Opening Chrome/Brave window to Facebook...")
    try {
      await axios.post(`${API_BASE}/auth/facebook/browser-login`)
      setBrowserStatus("opening")
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to launch browser")
      setLoading(false)
    }
  }

  // Poll browser login progress every 1.5s
  useEffect(() => {
    let interval = null
    if (browserStatus === "opening" || browserStatus === "waiting_login" || browserStatus === "extracting") {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/auth/facebook/browser-status`)
          const data = res.data
          setBrowserStatus(data.state)
          if (data.message) setBrowserMessage(data.message)

          if (data.state === "success") {
            clearInterval(interval)
            setLoading(false)
            const cleanPages = (data.pages || []).filter(p => !isNotificationItem(p))
            setFetchedPages(cleanPages)
            const initialSelected = new Set(
              cleanPages.filter(p => !existingPageIds.has(String(p.pageId))).map(p => String(p.pageId))
            )
            setSelectedIds(initialSelected)
          } else if (data.state === "error") {
            clearInterval(interval)
            setLoading(false)
            setError(data.error || "Browser login encountered an issue")
          }
        } catch (err) {
          console.warn("Poll status error:", err)
        }
      }, 1500)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [browserStatus, existingPageIds])

  const toggleSelect = (pageId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }

  const unimportedPages = useMemo(() => {
    return fetchedPages ? fetchedPages.filter(p => !existingPageIds.has(String(p.pageId))) : []
  }, [fetchedPages, existingPageIds])

  const filteredPages = useMemo(() => {
    if (!fetchedPages) return []
    if (!searchQuery.trim()) return fetchedPages
    const q = searchQuery.toLowerCase()
    return fetchedPages.filter(
      p => p.name.toLowerCase().includes(q) || String(p.pageId).includes(q)
    )
  }, [fetchedPages, searchQuery])

  const allSelected = unimportedPages.length > 0 && selectedIds.size === unimportedPages.length

  const toggleSelectAll = () => {
    if (!fetchedPages) return
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unimportedPages.map(p => String(p.pageId))))
    }
  }

  const handleConfirmImport = () => {
    if (!fetchedPages) return
    const toImport = fetchedPages
      .filter(p => selectedIds.has(String(p.pageId)))
      .map(p => ({
        name: p.name,
        username: p.category ? `@${p.category.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "",
        pageId: String(p.pageId),
        token: p.token || "browser_session",
        avatar: p.avatar,
        proxy: "",
        fans: p.fans || 0,
        isPermanent: true,
      }))
    onImport(toImport, null)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 620, maxWidth: "95vw" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                <Zap size={18} />
              </div>
              <h2 className="modal-title">Connect Facebook Pages</h2>
            </div>
            <p className="modal-subtitle">
              Log into Facebook directly in your browser. Zero developer setup or tokens required.
            </p>
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

        {/* Body Content */}
        {!fetchedPages ? (
          <div>
            <div style={{ textAlign: "center", padding: "16px 12px" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #1877f2, #2563eb)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  boxShadow: "0 0 24px rgba(24, 119, 242, 0.35)",
                }}
              >
                <Globe size={30} color="#fff" />
              </div>

              <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
                Direct Facebook Login
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto 20px", lineHeight: 1.5 }}>
                Click below to open a clean browser window to Facebook. Log into your account once — NexusPost will automatically discover your managed Pages and close the window!
              </p>

              {loading ? (
                <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <Loader size={28} className="spin" color="var(--accent)" />
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
                    {browserMessage || "Launching browser..."}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    Log into your Facebook account in the opened window.
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  style={{
                    background: "linear-gradient(135deg, #1877f2, #2563eb)",
                    borderColor: "#1877f2",
                    boxShadow: "0 0 20px rgba(24, 119, 242, 0.4)",
                    margin: "0 auto",
                    padding: "12px 28px",
                    fontSize: 15,
                  }}
                  onClick={startBrowserLogin}
                >
                  <Zap size={18} /> Open Facebook Login Window
                </button>
              )}

              <div
                style={{
                  marginTop: 24,
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <ShieldCheck size={20} color="var(--success)" style={{ flexShrink: 0 }} />
                <div>
                  <strong>100% Safe & Local:</strong> Your password and session stay strictly on your local computer. Never sent to any external server.
                </div>
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  background: "var(--danger-soft)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  borderRadius: "var(--radius-sm)",
                  color: "#fda4af",
                  fontSize: 12.5,
                }}
              >
                ⚠️ {error}
              </div>
            )}
          </div>
        ) : (
          /* Discovered Pages List */
          <div>
            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <ShieldCheck size={20} color="var(--success)" />
              <div style={{ fontSize: 12.5, color: "var(--text-primary)" }}>
                <strong>Pages Discovered:</strong> Found {fetchedPages.length} Pages/Profiles ready to import!
              </div>
            </div>

            {/* Search & Select All */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <input
                className="form-input"
                placeholder="Search found pages..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ maxWidth: 280, height: 34, fontSize: 12 }}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={toggleSelectAll}
                style={{ fontSize: 11 }}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
            </div>

            {/* List */}
            <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
              {filteredPages.map(page => {
                const isSelected = selectedIds.has(String(page.pageId))
                const isExisting = existingPageIds.has(String(page.pageId))
                return (
                  <div
                    key={page.pageId}
                    onClick={() => !isExisting && toggleSelect(String(page.pageId))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: isSelected ? "rgba(99, 102, 241, 0.08)" : "var(--bg-secondary)",
                      border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                      cursor: isExisting ? "default" : "pointer",
                      opacity: isExisting ? 0.6 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected || isExisting}
                      disabled={isExisting}
                      onChange={() => {}}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: "linear-gradient(135deg, #1877f2, #6366f1)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 12,
                        overflow: "hidden",
                      }}
                    >
                      {page.avatar ? (
                        <img src={page.avatar} alt={page.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        page.name[0]?.toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{page.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        ID: {page.pageId} {page.fans ? `• ${formatNumber(page.fans)} fans` : ""}
                      </div>
                    </div>
                    <span className="pill pill-success" style={{ fontSize: 10 }}>
                      <ShieldCheck size={11} /> Connected
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setFetchedPages(null)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={selectedIds.size === 0}
              >
                Import {selectedIds.size} Selected Pages
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ==========================================================================
   BULK IMPORT MODAL
   ========================================================================== */
function BulkImportModal({ onClose, onImport, existingPageIds, initialToken }) {
  const [token, setToken] = useState(initialToken || "")
  const [proxy, setProxy] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetchedPages, setFetchedPages] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [showPermissionsGuide, setShowPermissionsGuide] = useState(false)

  const savedSettings = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("sap_settings")) || {}
    } catch {
      return {}
    }
  }, [])

  const handleFetch = async (e) => {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    setError("")
    setFetchedPages(null)
    setSelectedIds(new Set())

    try {
      const res = await axios.get(`${API_BASE}/fetch-pages`, {
        params: {
          token: token.trim(),
          app_id: savedSettings.facebookAppId || undefined,
          app_secret: savedSettings.facebookAppSecret || undefined,
        },
      })
      const pages = res.data.pages || []
      setFetchedPages(pages)
      const initialSelected = new Set(
        pages.filter(p => !existingPageIds.has(String(p.pageId))).map(p => String(p.pageId))
      )
      setSelectedIds(initialSelected)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Failed to fetch pages"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (pageId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }

  const unimportedPages = useMemo(() => {
    return fetchedPages ? fetchedPages.filter(p => !existingPageIds.has(String(p.pageId))) : []
  }, [fetchedPages, existingPageIds])

  const filteredPages = useMemo(() => {
    if (!fetchedPages) return []
    if (!searchQuery.trim()) return fetchedPages
    const q = searchQuery.toLowerCase()
    return fetchedPages.filter(
      p => p.name.toLowerCase().includes(q) || String(p.pageId).includes(q)
    )
  }, [fetchedPages, searchQuery])

  const allSelected = unimportedPages.length > 0 && selectedIds.size === unimportedPages.length

  const toggleSelectAll = () => {
    if (!fetchedPages) return
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unimportedPages.map(p => String(p.pageId))))
    }
  }

  const handleConfirmImport = () => {
    if (!fetchedPages) return
    const toImport = fetchedPages
      .filter(p => selectedIds.has(String(p.pageId)))
      .map(p => ({
        name: p.name,
        username: p.category ? `@${p.category.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "",
        pageId: String(p.pageId),
        token: p.token,
        avatar: p.avatar,
        proxy: proxy.trim(),
        fans: p.fans || 0,
      }))
    onImport(toImport, token.trim())
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 640, maxWidth: "95vw" }} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "var(--radius-xs)",
                  background: "var(--accent-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent)",
                }}
              >
                <Zap size={16} />
              </div>
              <h2 className="modal-title">Bulk Import Facebook Pages</h2>
            </div>
            <p className="modal-subtitle">
              Provide one Master User Access Token to detect and import all your pages automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: "var(--radius-xs)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleFetch} className="space-y-4">
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label">Master User Access Token *</label>
              <button
                type="button"
                onClick={() => setShowPermissionsGuide(!showPermissionsGuide)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={12} /> {showPermissionsGuide ? "Hide instructions" : "How to get token?"}
              </button>
            </div>

            {/* Expandable Permissions Guide */}
            {showPermissionsGuide && (
              <div
                style={{
                  background: "rgba(99, 102, 241, 0.08)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "var(--text-secondary)",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                  Follow these 3 quick steps:
                </div>
                <ol style={{ paddingLeft: 18 }}>
                  <li>
                    Open{" "}
                    <a
                      href="https://developers.facebook.com/tools/explorer/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 600 }}
                    >
                      Meta Graph API Explorer <ExternalLink size={10} style={{ display: "inline" }} />
                    </a>
                  </li>
                  <li>Set <strong>User or Page</strong> to <code>Get User Access Token</code></li>
                  <li>
                    Add these 3 permissions:{" "}
                    <span style={{ color: "var(--accent)", fontFamily: "JetBrains Mono, monospace" }}>
                      pages_show_list, pages_read_engagement, pages_manage_posts
                    </span>
                  </li>
                  <li>Click <strong>Generate Access Token</strong> and grant access to your Pages.</li>
                </ol>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <input
                className="form-input"
                type="password"
                placeholder="EAAGm0P..."
                value={token}
                onChange={e => setToken(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !token.trim()}
                style={{ minWidth: 125 }}
              >
                {loading ? <Loader size={14} className="spin" /> : <Layers size={14} />}
                {loading ? "Searching..." : "Fetch Pages"}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Proxy for all imported pages (Optional)</label>
            <input
              className="form-input"
              placeholder="http://username:password@ip:port"
              value={proxy}
              onChange={e => setProxy(e.target.value)}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              All imported pages will route automation traffic through this proxy.
            </span>
          </div>
        </form>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "var(--danger-soft)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              borderRadius: "var(--radius-sm)",
              color: "#fda4af",
              fontSize: 12.5,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              lineHeight: 1.5,
            }}
          >
            <ShieldAlert size={18} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
            <div>{error}</div>
          </div>
        )}

        {/* Fetched Pages Result */}
        {fetchedPages && (
          <div style={{ marginTop: 22, borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                  Discovered {fetchedPages.length} {fetchedPages.length === 1 ? "Page" : "Pages"}
                </span>
                <span className="pill pill-info">
                  {selectedIds.size} selected
                </span>
              </div>

              {unimportedPages.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  {allSelected ? "Deselect All" : "Select All Available"}
                </button>
              )}
            </div>

            {fetchedPages.length > 4 && (
              <div className="search-filter-bar" style={{ marginBottom: 12, padding: "6px 12px" }}>
                <Search size={14} style={{ color: "var(--text-muted)" }} />
                <input
                  className="search-filter-input"
                  placeholder="Filter discovered pages..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ fontSize: 12.5 }}
                />
              </div>
            )}

            {fetchedPages.length === 0 ? (
              <div
                style={{
                  padding: 28,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                No Facebook Pages found for this token. Verify that your token has <code>pages_show_list</code> permission.
              </div>
            ) : (
              <div
                style={{
                  maxHeight: 250,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  paddingRight: 4,
                }}
              >
                {filteredPages.map(page => {
                  const isExisting = existingPageIds.has(String(page.pageId))
                  const isChecked = selectedIds.has(String(page.pageId))

                  return (
                    <div
                      key={page.pageId}
                      onClick={() => !isExisting && toggleSelect(String(page.pageId))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        background: isChecked ? "rgba(99, 102, 241, 0.08)" : "var(--bg-card)",
                        border: `1px solid ${isChecked ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: "var(--radius-sm)",
                        cursor: isExisting ? "default" : "pointer",
                        opacity: isExisting ? 0.5 : 1,
                        transition: "all 0.16s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isExisting}
                        onChange={() => {}}
                        style={{
                          cursor: isExisting ? "default" : "pointer",
                          accentColor: "var(--accent)",
                          width: 16,
                          height: 16,
                        }}
                      />
                      {page.avatar ? (
                        <img
                          src={page.avatar}
                          alt={page.name}
                          style={{ width: 34, height: 34, borderRadius: "var(--radius-xs)", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "var(--radius-xs)",
                            background: "linear-gradient(135deg, #1877f2, #6366f1)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          {page.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {page.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", gap: 8 }}>
                          <span>ID: {page.pageId}</span>
                          <span>•</span>
                          <span>{formatNumber(page.fans)} followers</span>
                          {page.category && <span>• {page.category}</span>}
                        </div>
                      </div>
                      {isExisting && (
                        <span
                          style={{
                            fontSize: 10.5,
                            padding: "3px 8px",
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid var(--border)",
                            color: "var(--text-muted)",
                            borderRadius: "var(--radius-full)",
                            fontWeight: 600,
                          }}
                        >
                          Already Added
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={selectedIds.size === 0}
              >
                <Check size={14} /> Import Selected ({selectedIds.size})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ==========================================================================
   ADD SINGLE ACCOUNT MODAL
   ========================================================================== */
function AddAccountModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: "", username: "", token: "", pageId: "", proxy: "" })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.token || !form.pageId) return
    onAdd({ ...form, platform: "facebook", status: "active" })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h2 className="modal-title">Connect Facebook Page</h2>
            <p className="modal-subtitle">Directly link a single Facebook Page using its Page Token</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Page Name *</label>
            <input
              className="form-input"
              placeholder="e.g. My Official Brand"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Page ID *</label>
            <input
              className="form-input"
              placeholder="e.g. 1433460533177690"
              value={form.pageId}
              onChange={e => setForm(p => ({ ...p, pageId: e.target.value }))}
              required
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Find your Page ID in Facebook &gt; Page &gt; About &gt; Page transparency
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Page Access Token *</label>
            <input
              className="form-input"
              type="password"
              placeholder="EAAGm0P..."
              value={form.token}
              onChange={e => setForm(p => ({ ...p, token: e.target.value }))}
              required
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Generate in{" "}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                Graph API Explorer
              </a>
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Proxy (Optional)</label>
            <input
              className="form-input"
              placeholder="http://user:pass@ip:port"
              value={form.proxy}
              onChange={e => setForm(p => ({ ...p, proxy: e.target.value }))}
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={14} /> Link Account
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ==========================================================================
   MAIN ACCOUNTS PAGE
   ========================================================================== */
export default function Accounts() {
  const { accounts, masterToken, setMasterToken, addAccount, addAccounts, deduplicateAccounts, syncPages, removeAccount, updateAccount } =
    useAccounts()
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showOAuthModal, setShowOAuthModal] = useState(false)
  const [showTokenDropdown, setShowTokenDropdown] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [validating, setValidating] = useState({})
  const [copiedId, setCopiedId] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // all | active | expired

  const tokenDropdownRef = useRef(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(e.target)) {
        setShowTokenDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const existingPageIds = useMemo(() => new Set(accounts.map(a => String(a.pageId))), [accounts])

  // Detect items that are Facebook notification alerts rather than actual Pages
  const notificationAccounts = useMemo(() => {
    return accounts.filter(isNotificationItem)
  }, [accounts])

  // Detect duplicate accounts with the same name
  const duplicateAccounts = useMemo(() => {
    const counts = {}
    accounts.forEach(a => {
      const key = a.name.toLowerCase().trim()
      counts[key] = (counts[key] || 0) + 1
    })
    return accounts.filter(a => counts[a.name.toLowerCase().trim()] > 1)
  }, [accounts])

  const handleCleanNotifications = () => {
    const count = notificationAccounts.length
    notificationAccounts.forEach(acc => removeAccount(acc.id))
    toast(`🧹 Removed ${count} notification item${count > 1 ? "s" : ""}!`, "success")
  }

  const handleCleanDuplicates = () => {
    const removedCount = deduplicateAccounts()
    toast(`✨ Merged and removed ${removedCount} duplicate account${removedCount > 1 ? "s" : ""}!`, "success")
  }

  const totalFollowers = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + (curr.fans || 0), 0)
  }, [accounts])

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchesSearch =
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(acc.pageId).includes(searchQuery.trim())
      const matchesStatus = statusFilter === "all" || acc.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [accounts, searchQuery, statusFilter])

  const handleCopyId = (pageId) => {
    navigator.clipboard.writeText(String(pageId))
    setCopiedId(pageId)
    setTimeout(() => setCopiedId(null), 1800)
    toast("Page ID copied to clipboard", "info")
  }

  const handleAdd = (acc) => {
    addAccount(acc)
    toast(`Added "${acc.name}"`, "success")
  }

  const handleBulkImport = (newAccounts, tokenUsed) => {
    if (tokenUsed) {
      setMasterToken(tokenUsed)
    }
    const { addedCount } = addAccounts(newAccounts)
    toast(`🎉 Successfully imported ${addedCount} Pages!`, "success")
  }

  const handleQuickSync = async () => {
    if (!masterToken) {
      toast("No Master Token saved yet. Opening bulk import...", "info")
      setShowBulkModal(true)
      return
    }
    setSyncing(true)
    try {
      const { totalFound, addedCount, addedList } = await syncPages()
      if (addedCount > 0) {
        const names = addedList.map(a => a.name).join(", ")
        toast(`🎉 Synced ${addedCount} new Pages: ${names}!`, "success")
      } else {
        toast(`✅ All up to date! Found ${totalFound} Pages (no new pages to add).`, "info")
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Failed to sync pages"
      toast(`❌ Sync error: ${msg}`, "error")
    } finally {
      setSyncing(false)
    }
  }

  const handleRemove = (id, name) => {
    if (confirm(`Remove account "${name}"?`)) {
      removeAccount(id)
      toast("Account removed", "info")
    }
  }

  const handleValidate = async (acc) => {
    setValidating(v => ({ ...v, [acc.id]: true }))
    try {
      const { data } = await axios.get(`${API_BASE}/validate-token`, {
        params: { token: acc.token, page_id: acc.pageId },
      })
      if (data.fans !== undefined) {
        updateAccount(acc.id, { fans: data.fans, status: "active" })
      }
      toast(`✅ Valid! "${data.page_name}" — ${formatNumber(data.fans)} followers`, "success")
    } catch (err) {
      const msg = err.response?.data?.detail || "Token invalid or expired"
      updateAccount(acc.id, { status: "expired" })
      toast(`❌ ${msg}`, "error")
    } finally {
      setValidating(v => ({ ...v, [acc.id]: false }))
    }
  }

  const activeCount = accounts.filter(a => a.status === "active").length
  const expiredCount = accounts.filter(a => a.status === "expired").length

  return (
    <div>
      {/* Page Header */}
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
            <h1 className="page-title">Accounts</h1>
            <span className="pill pill-info">
              {accounts.length} {accounts.length === 1 ? "Page" : "Pages"}
            </span>
          </div>
          <p className="page-subtitle">
            Manage your connected Facebook Pages, verify permissions, and refresh page access.
          </p>
        </div>

        {/* Action Buttons: Simple 1-Click Hero + Grouped Token Dropdown */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Main Hero: 1-Click Facebook Browser Login */}
          <button
            className="btn btn-primary"
            style={{
              background: "linear-gradient(135deg, #1877f2, #2563eb)",
              borderColor: "#1877f2",
              boxShadow: "0 0 16px rgba(24, 119, 242, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              fontWeight: 700,
            }}
            onClick={() => setShowOAuthModal(true)}
          >
            <Zap size={16} /> 1-Click Facebook Login
          </button>

          {/* Grouped Token & Manual Dropdown */}
          <div style={{ position: "relative" }} ref={tokenDropdownRef}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowTokenDropdown(prev => !prev)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 16px",
              }}
            >
              <Key size={15} style={{ color: "var(--accent)" }} />
              <span>Token & Manual</span>
              <ChevronDown
                size={14}
                style={{
                  transition: "transform 0.2s ease",
                  transform: showTokenDropdown ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {showTokenDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: 260,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  boxShadow: "0 12px 36px rgba(0, 0, 0, 0.5)",
                  padding: "6px",
                  zIndex: 100,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {/* 1. Sync Pages */}
                <button
                  type="button"
                  onClick={() => {
                    setShowTokenDropdown(false)
                    handleQuickSync()
                  }}
                  disabled={syncing}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 12px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "var(--radius-xs)",
                      background: "rgba(99, 102, 241, 0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--accent)",
                      flexShrink: 0,
                    }}
                  >
                    <RefreshCw size={14} className={syncing ? "spin" : ""} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Sync New Pages</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Refresh with Master Token</div>
                  </div>
                </button>

                {/* 2. Token Import */}
                <button
                  type="button"
                  onClick={() => {
                    setShowTokenDropdown(false)
                    setShowBulkModal(true)
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 12px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "var(--radius-xs)",
                      background: "rgba(16, 185, 129, 0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--success)",
                      flexShrink: 0,
                    }}
                  >
                    <Layers size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Bulk Token Import</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Paste Graph API Token</div>
                  </div>
                </button>

                {/* 3. Add Single Page */}
                <button
                  type="button"
                  onClick={() => {
                    setShowTokenDropdown(false)
                    setShowModal(true)
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 12px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "var(--radius-xs)",
                      background: "rgba(255, 255, 255, 0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-secondary)",
                      flexShrink: 0,
                    }}
                  >
                    <Plus size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Add Single Page</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Manual Page ID & Token</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Smart Notification Cleanup Banner */}
      {notificationAccounts.length > 0 && (
        <div
          style={{
            background: "rgba(244, 63, 94, 0.08)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            borderRadius: "var(--radius)",
            padding: "14px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            boxShadow: "0 0 20px rgba(244, 63, 94, 0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "rgba(244, 63, 94, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--danger)",
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                {notificationAccounts.length} Facebook Notification Alert{notificationAccounts.length > 1 ? "s" : ""} Detected
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                Facebook navigation notifications were accidentally imported (
                {notificationAccounts.map(a => `"${a.name}"`).join(", ")}). Clean them up in 1 click:
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              background: "var(--danger)",
              color: "#fff",
              borderColor: "var(--danger)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 700,
              padding: "8px 18px",
              boxShadow: "0 0 14px rgba(244, 63, 94, 0.3)",
            }}
            onClick={handleCleanNotifications}
          >
            <Trash2 size={14} /> Remove {notificationAccounts.length} Notification{notificationAccounts.length > 1 ? "s" : ""}
          </button>
        </div>
      )}

      {/* Duplicate Names Cleanup Banner */}
      {notificationAccounts.length === 0 && duplicateAccounts.length > 0 && (
        <div
          style={{
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            borderRadius: "var(--radius)",
            padding: "12px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Info size={18} color="var(--accent)" />
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
              Detected duplicate pages with matching names ({[...new Set(duplicateAccounts.map(a => `"${a.name}"`))].join(", ")}).
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11.5 }}
            onClick={handleCleanDuplicates}
          >
            Deduplicate Pages
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      {accounts.length > 0 && (
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
          {/* Search Input */}
          <div className="search-filter-bar" style={{ minWidth: 280, flex: 1, maxWidth: 440 }}>
            <Search size={15} style={{ color: "var(--text-muted)" }} />
            <input
              className="search-filter-input"
              placeholder="Search by page name or numeric ID..."
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

          {/* Filter Tabs */}
          <div style={{ display: "flex", gap: 6, background: "var(--bg-secondary)", padding: 4, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <button
              onClick={() => setStatusFilter("all")}
              className={`btn btn-sm ${statusFilter === "all" ? "btn-secondary" : "btn-outline"}`}
              style={{ border: "none", padding: "5px 12px" }}
            >
              All ({accounts.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`btn btn-sm ${statusFilter === "active" ? "btn-secondary" : "btn-outline"}`}
              style={{ border: "none", padding: "5px 12px", color: statusFilter === "active" ? "var(--success)" : undefined }}
            >
              Active ({activeCount})
            </button>
            {expiredCount > 0 && (
              <button
                onClick={() => setStatusFilter("expired")}
                className={`btn btn-sm ${statusFilter === "expired" ? "btn-secondary" : "btn-outline"}`}
                style={{ border: "none", padding: "5px 12px", color: statusFilter === "expired" ? "var(--danger)" : undefined }}
              >
                Expired ({expiredCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Accounts Content */}
      {accounts.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px" }}>
          <div className="empty-state" style={{ padding: 0 }}>
            <div className="empty-state-icon">
              <UsersIcon size={26} style={{ color: "var(--accent)" }} />
            </div>
            <div className="empty-state-title">No Facebook Pages Connected Yet</div>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 24, maxWidth: 440, margin: "0 auto 24px" }}>
              Connect your Facebook Pages to publish posts simultaneously and run automated warm-up sessions.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-lg" onClick={() => setShowBulkModal(true)}>
                <Zap size={18} /> Bulk Import All Pages
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => setShowModal(true)}>
                <Plus size={18} /> Add Single Page
              </button>
            </div>
          </div>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="card" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
          <Search size={28} style={{ opacity: 0.3, marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>No pages matched your search</div>
          <p style={{ fontSize: 13, marginTop: 4 }}>Try clearing the search query or status filter.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filteredAccounts.map(acc => {
            const isCopied = copiedId === acc.pageId
            const isValidating = validating[acc.id]
            const isNotification = isNotificationItem(acc)

            return (
              <div
                key={acc.id}
                className="account-card"
                style={isNotification ? { borderColor: "rgba(244, 63, 94, 0.4)", background: "rgba(244, 63, 94, 0.04)" } : {}}
              >
                {/* Card Top: Avatar, Name, Status */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  {acc.avatar ? (
                    <div className="account-avatar">
                      <img src={acc.avatar} alt={acc.name} />
                    </div>
                  ) : (
                    <div className="account-avatar">
                      {acc.name[0]?.toUpperCase() || "F"}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="account-name"
                      title={acc.name}
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {acc.name}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <span className="platform-badge facebook">
                        <span style={{ fontWeight: 800 }}>f</span> Facebook Page
                      </span>
                      {acc.fans !== undefined && (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            background: "rgba(255, 255, 255, 0.04)",
                            padding: "3px 8px",
                            borderRadius: "var(--radius-full)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          👥 {formatNumber(acc.fans)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <div className="account-status">
                      <div className={`status-dot ${isNotification ? "expired" : acc.status}`} />
                      <span
                        style={{
                          color: isNotification ? "var(--danger)" : acc.status === "active" ? "var(--success)" : "var(--danger)",
                          fontSize: 11.5,
                          textTransform: "capitalize",
                          fontWeight: 700,
                        }}
                      >
                        {isNotification ? "Notification" : acc.status}
                      </span>
                    </div>
                    {isNotification ? (
                      <span
                        className="pill pill-danger"
                        style={{ fontSize: 9.5, padding: "1px 6px", background: "rgba(244, 63, 94, 0.2)", color: "#f87171" }}
                      >
                        <ShieldAlert size={10} /> Not a Page
                      </span>
                    ) : acc.isPermanent ? (
                      <span className="pill pill-success" style={{ fontSize: 9.5, padding: "1px 6px" }}>
                        <ShieldCheck size={10} /> Permanent
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Meta details: Page ID & Proxy */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-sm)",
                    margin: "14px 0 12px",
                    border: "1px solid var(--border-subtle)",
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)" }}>
                    <span>ID:</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)", fontWeight: 500 }}>
                      {acc.pageId}
                    </span>
                    <button
                      onClick={() => handleCopyId(acc.pageId)}
                      title="Copy numeric Page ID"
                      style={{
                        background: "none",
                        border: "none",
                        color: isCopied ? "var(--success)" : "var(--text-muted)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        padding: 2,
                      }}
                    >
                      {isCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    </button>
                  </div>

                  {acc.proxy ? (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--accent)",
                        background: "var(--accent-soft)",
                        padding: "2px 7px",
                        borderRadius: "var(--radius-xs)",
                        fontWeight: 600,
                      }}
                    >
                      Proxy Active
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>
                      Direct Connection
                    </span>
                  )}
                </div>

                {/* Card Action Footer */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid var(--border-subtle)",
                    paddingTop: 12,
                  }}
                >
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleValidate(acc)}
                    disabled={isValidating}
                    style={{ flex: 1 }}
                  >
                    {isValidating ? (
                      <Loader size={13} className="spin" />
                    ) : (
                      <ShieldCheck size={14} style={{ color: "var(--success)" }} />
                    )}
                    {isValidating ? "Validating..." : "Validate Token"}
                  </button>

                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemove(acc.id, acc.name)}
                    title="Remove Account"
                    style={{ padding: "6px 10px" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showOAuthModal && (
        <FacebookLoginModal
          onClose={() => setShowOAuthModal(false)}
          onImport={handleBulkImport}
          existingPageIds={existingPageIds}
        />
      )}
      {showModal && <AddAccountModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
      {showBulkModal && (
        <BulkImportModal
          onClose={() => setShowBulkModal(false)}
          onImport={handleBulkImport}
          existingPageIds={existingPageIds}
          initialToken={masterToken}
        />
      )}
    </div>
  )
}
