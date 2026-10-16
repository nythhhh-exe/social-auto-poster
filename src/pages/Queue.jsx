import { useState, useMemo, useEffect, useRef } from "react"
import { useQueue } from "../context/QueueContext"
import { useAccounts } from "../context/AccountsContext"
import { useLogs } from "../context/LogsContext"
import { useToast } from "../context/ToastContext"
import { useNavigate } from "react-router-dom"
import {
  CalendarClock,
  Clock,
  Trash2,
  Plus,
  Play,
  Layers,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  X,
  FileVideo,
  FileImage,
  Info,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Eye,
  Loader,
  RefreshCw,
  Upload,
  Edit3,
  Check,
} from "lucide-react"
import axios from "axios"
import { API_BASE } from "../config"

// Format countdown remaining until release
function getCountdown(scheduledTime) {
  if (!scheduledTime) return "—"
  const now = Math.floor(Date.now() / 1000)
  const diffSecs = scheduledTime - now

  if (diffSecs <= -60) return "Published"
  if (diffSecs <= 0) return "🚀 Releasing now..."
  const hours = Math.floor(diffSecs / 3600)
  const mins = Math.floor((diffSecs % 3600) / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `in ${days}d ${hours % 24}h`
  if (hours > 0) return `in ${hours}h ${mins}m`
  return `in ${mins} mins`
}

// Normalize list of post IDs from various stored formats (strings, objects, single postId)
function getPostIdsList(item) {
  if (!item) return []
  if (Array.isArray(item.fbPostIds)) {
    return item.fbPostIds.map(p => {
      if (typeof p === "string" && p.trim()) return { postId: p.trim(), pageId: null }
      if (p && typeof p === "object") {
        const pid = p.postId || p.id
        if (pid) return { postId: String(pid).trim(), pageId: p.pageId ? String(p.pageId).trim() : null }
      }
      return null
    }).filter(Boolean)
  }
  if (item.postId) return [{ postId: String(item.postId).trim(), pageId: null }]
  return []
}

// Find a valid Meta Graph API token (skips browser_session)
function getValidToken(accounts, preferredPageId = null) {
  const masterToken = (localStorage.getItem("sap_master_token") || "").trim()

  // 1. Check account matching pageId that has a real Graph API token
  if (preferredPageId && accounts?.length) {
    const acc = accounts.find(a =>
      (String(a.pageId) === String(preferredPageId) || String(a.id) === String(preferredPageId)) &&
      a.token && a.token !== "browser_session"
    )
    if (acc?.token) return acc.token.trim()
  }

  // 2. Find any account with a real token (starts with EA or not browser_session)
  if (accounts?.length) {
    const eaAcc = accounts.find(a => a.token && a.token.startsWith("EA"))
    if (eaAcc?.token) return eaAcc.token.trim()

    const anyAcc = accounts.find(a => a.token && a.token !== "browser_session")
    if (anyAcc?.token) return anyAcc.token.trim()
  }

  // 3. Fallback to master token
  if (masterToken && masterToken !== "browser_session") {
    return masterToken
  }

  return null
}

// Preview Modal for Scheduled Posts (Strictly View-Only)
function QueuePreviewModal({ item, onClose, onDelete, accounts, onUpdateItem, onOpenEdit }) {
  if (!item) return null

  const [photoUrl, setPhotoUrl] = useState(item.mediaPreview || item.mediaUrl || null)
  const [loadingPhoto, setLoadingPhoto] = useState(false)

  // Fetch real photo URL from Facebook Graph API if not cached locally
  const fetchMedia = async () => {
    if (item.mediaPreview || item.mediaUrl) {
      setPhotoUrl(item.mediaPreview || item.mediaUrl)
      return
    }

    const postList = getPostIdsList(item)
    if (postList.length === 0) return

    setLoadingPhoto(true)

    let foundUrl = null
    for (const postInfo of postList) {
      if (!postInfo?.postId) continue
      const token = getValidToken(accounts, postInfo.pageId)
      if (!token) continue
      try {
        const res = await axios.get(`${API_BASE}/post-media`, {
          params: { post_id: postInfo.postId, token }
        })
        if (res.data?.url) {
          foundUrl = res.data.url
          break
        }
      } catch (err) {
        console.warn("Could not fetch media for post:", postInfo.postId, err)
      }
    }

    if (foundUrl) {
      setPhotoUrl(foundUrl)
      item.mediaPreview = foundUrl
      if (onUpdateItem) {
        onUpdateItem(item.id, { mediaPreview: foundUrl })
      }
    }
    setLoadingPhoto(false)
  }

  useEffect(() => {
    fetchMedia()
  }, [item, accounts])

  const dateStr = item.scheduledTime
    ? new Date(item.scheduledTime * 1000).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Immediate"

  const countdown = getCountdown(item.scheduledTime)
  const targetPages = item.targetAccountNames?.length > 0 ? item.targetAccountNames : ["All Connected Pages"]

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
                background: "rgba(99, 102, 241, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Eye size={18} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: 16 }}>Scheduled Post Preview</h2>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                Releasing {countdown} • {dateStr}
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

        {/* Target Pages */}
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Target Pages:</span>
          {targetPages.map((name, i) => (
            <span key={i} className="platform-badge facebook" style={{ fontSize: 11 }}>
              <span style={{ fontWeight: 800 }}>f</span> {name}
            </span>
          ))}
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
              {targetPages[0]?.[0]?.toUpperCase() || "F"}
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>
                {targetPages.join(", ")}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} /> Scheduled for {dateStr}
              </div>
            </div>
          </div>

          {/* Caption */}
          {item.caption && (
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
              {item.caption}
            </div>
          )}

          {/* Media Box: Real Photo / Video */}
          {(photoUrl || item.mediaFilename) && (
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
                    alt={item.caption || "Post media"}
                    style={{
                      width: "100%",
                      maxHeight: 380,
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                  {item.mediaFilename && (
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
                      <FileImage size={11} /> {item.mediaFilename}
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
                  {item.mediaType === "video" ? (
                    <>
                      <FileVideo size={38} style={{ color: "var(--accent)" }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {item.mediaFilename}
                      </div>
                      <span className="pill pill-info" style={{ fontSize: 10 }}>
                        Video Post
                      </span>
                    </>
                  ) : (
                    <>
                      <FileImage size={38} style={{ color: "#38bdf8" }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {item.mediaFilename || "Image Post"}
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
          {item.comment && (
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
                {item.comment}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              onDelete(item)
              onClose()
            }}
          >
            <Trash2 size={13} /> Cancel Scheduled Post
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {onOpenEdit && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose()
                  onOpenEdit(item)
                }}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Edit3 size={14} /> Edit Post
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Comprehensive Edit Modal for Scheduled Posts (Edit Everything)
function QueueEditModal({ item, onClose, accounts, onUpdateItem, toast }) {
  if (!item) return null

  const toLocalString = (d) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const hours = String(d.getHours()).padStart(2, "0")
    const minutes = String(d.getMinutes()).padStart(2, "0")
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // 1. Caption
  const [caption, setCaption] = useState(item.caption || "")

  // 2. Auto Comment
  const [comment, setComment] = useState(item.comment || "")

  // 3. Timing
  const [datetimeStr, setDatetimeStr] = useState(() => {
    const d = item.scheduledTime ? new Date(item.scheduledTime * 1000) : new Date(Date.now() + 3600 * 1000)
    return toLocalString(d)
  })
  const [activePreset, setActivePreset] = useState(null)

  // 4. Target Pages
  const [selectedAccountIds, setSelectedAccountIds] = useState(() => {
    if (item.targetAccountNames?.length && accounts?.length) {
      const matched = accounts
        .filter(a => item.targetAccountNames.includes(a.name))
        .map(a => a.id)
      if (matched.length > 0) return matched
    }
    return accounts?.map(a => a.id) || []
  })

  // 5. Media State
  const [mediaFile, setMediaFile] = useState(null) // New file if uploaded
  const [mediaPreview, setMediaPreview] = useState(item.mediaPreview || null)
  const [mediaFilename, setMediaFilename] = useState(item.mediaFilename || "")
  const [mediaType, setMediaType] = useState(item.mediaType || "text")
  const [isRemovedMedia, setIsRemovedMedia] = useState(false)

  const [isSaving, setIsSaving] = useState(false)

  const parsedDate = useMemo(() => new Date(datetimeStr), [datetimeStr])
  const targetUnix = useMemo(() => Math.floor(parsedDate.getTime() / 1000), [parsedDate])

  const minDatetimeStr = useMemo(() => {
    const minD = new Date(Date.now() + 11 * 60 * 1000)
    return toLocalString(minD)
  }, [])

  const applyPreset = (presetKey, minutesFromNow = 0, hourOfDay = null) => {
    setActivePreset(presetKey)
    const d = new Date()
    if (hourOfDay !== null) {
      if (presetKey === "tonight") {
        d.setHours(hourOfDay, 0, 0, 0)
        if (d.getTime() < Date.now() + 15 * 60 * 1000) {
          d.setDate(d.getDate() + 1)
        }
      } else {
        d.setDate(d.getDate() + 1)
        d.setHours(hourOfDay, 0, 0, 0)
      }
    } else {
      d.setMinutes(d.getMinutes() + minutesFromNow)
    }
    setDatetimeStr(toLocalString(d))
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isVid = file.type.startsWith("video")
    setMediaFile(file)
    setMediaFilename(file.name)
    setMediaType(isVid ? "video" : "image")
    setIsRemovedMedia(false)

    if (!isVid) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = new window.Image()
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
          setMediaPreview(canvas.toDataURL("image/jpeg", 0.82))
        }
        img.onerror = () => setMediaPreview(ev.target.result)
        img.src = ev.target.result
      }
      reader.readAsDataURL(file)
    } else {
      setMediaPreview(null)
    }
  }

  const handleRemoveMedia = () => {
    setMediaFile(null)
    setMediaPreview(null)
    setMediaFilename("")
    setMediaType("text")
    setIsRemovedMedia(true)
  }

  const togglePage = (accId) => {
    setSelectedAccountIds(prev =>
      prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]
    )
  }

  const handleSave = async () => {
    if (!caption.trim()) {
      toast("Please write a post caption!", "error")
      return
    }
    if (selectedAccountIds.length === 0) {
      toast("Select at least one target Facebook page!", "error")
      return
    }

    const minTimestamp = Math.floor(Date.now() / 1000) + 600
    if (targetUnix < minTimestamp) {
      toast("Scheduled time must be at least 10 minutes in the future for Facebook", "error")
      return
    }

    setIsSaving(true)

    const targetAccounts = accounts.filter(a => selectedAccountIds.includes(a.id))
    const oldPostList = getPostIdsList(item)

    // Check if re-posting is needed (if new media uploaded or media removed or pages changed)
    const mediaChanged = !!mediaFile || isRemovedMedia
    const pagesChanged = JSON.stringify(selectedAccountIds.slice().sort()) !== JSON.stringify(
      (item.targetAccountNames || []).map(n => accounts.find(a => a.name === n)?.id).filter(Boolean).sort()
    )

    let updatedFbPostIds = item.fbPostIds || []

    if (mediaChanged || pagesChanged) {
      // 1. Delete previous scheduled posts from Facebook
      for (const p of oldPostList) {
        if (!p?.postId) continue
        const token = getValidToken(accounts, p.pageId)
        if (token) {
          try {
            await axios.delete(`${API_BASE}/scheduled-posts/${p.postId}`, { params: { token } })
          } catch (e) {
            console.warn("Could not delete old post:", p.postId, e)
          }
        }
      }

      // 2. Submit new scheduled post to Facebook
      try {
        const formData = new FormData()
        formData.append("caption", caption)
        formData.append("comment", comment)
        formData.append("delay", "3")
        formData.append("accounts", JSON.stringify(targetAccounts))
        formData.append("scheduled_time", String(targetUnix))
        if (mediaFile) {
          formData.append("media", mediaFile, mediaFile.name)
        }

        const { data } = await axios.post(`${API_BASE}/post`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })

        if (data.results) {
          updatedFbPostIds = data.results
            .filter(r => r.status === "success" && r.postId)
            .map(r => ({ postId: r.postId, pageId: accounts.find(a => a.id === r.accountId)?.pageId }))
        }
      } catch (err) {
        console.warn("Could not re-schedule on Facebook:", err)
      }
    } else {
      // Only caption, time, or comment changed - update in place on Facebook
      for (const p of oldPostList) {
        if (!p?.postId) continue
        const token = getValidToken(accounts, p.pageId)
        if (token) {
          try {
            const formData = new FormData()
            formData.append("scheduled_time", String(targetUnix))
            formData.append("caption", caption)
            formData.append("token", token)
            await axios.post(`${API_BASE}/scheduled-posts/${p.postId}/update`, formData)
          } catch (e) {
            console.warn("Could not update post on Facebook:", p.postId, e)
          }
        }
      }
    }

    // Update local queue
    onUpdateItem(item.id, {
      caption,
      comment,
      scheduledTime: targetUnix,
      mediaType: isRemovedMedia ? "text" : mediaType,
      mediaFilename: isRemovedMedia ? "" : mediaFilename,
      mediaPreview: isRemovedMedia ? null : (mediaPreview || item.mediaPreview),
      targetAccountNames: targetAccounts.map(a => a.name),
      fbPostIds: updatedFbPostIds,
    })

    setIsSaving(false)
    toast("✅ Scheduled post updated successfully!", "success")
    onClose()
  }

  const countdown = getCountdown(targetUnix)
  const fullDateStr = parsedDate.toLocaleString(undefined, {
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
      <div className="modal" style={{ width: 620, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-xs)",
                background: "rgba(99, 102, 241, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Edit3 size={18} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: 16 }}>Edit Scheduled Post</h2>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                Update caption, media, target pages, or release schedule
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

        {/* 1. Post Caption */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
            <span>✍️ Post Caption</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{caption.length} chars</span>
          </label>
          <textarea
            className="form-input"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Write your post caption..."
            style={{ minHeight: 90, resize: "vertical", fontSize: 13 }}
          />
        </div>

        {/* 2. Media Section */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
            📸 Media (Photo or Video)
          </label>

          {!isRemovedMedia && (mediaPreview || mediaFilename) ? (
            <div
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {mediaPreview ? (
                  <img
                    src={mediaPreview}
                    alt="Thumbnail"
                    style={{ width: 48, height: 48, borderRadius: "var(--radius-xs)", objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "var(--radius-xs)",
                      background: "rgba(99, 102, 241, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--accent)",
                      flexShrink: 0,
                    }}
                  >
                    {mediaType === "video" ? <FileVideo size={22} /> : <FileImage size={22} />}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {mediaFilename || (mediaType === "video" ? "Video file" : "Attached photo")}
                  </div>
                  <span className="pill pill-info" style={{ fontSize: 9.5, marginTop: 3 }}>
                    {mediaType === "video" ? "Video Post" : "Photo Post"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", fontSize: 11, padding: "5px 10px" }}>
                  <RefreshCw size={12} /> Replace
                  <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFileChange} />
                </label>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ fontSize: 11, padding: "5px 10px" }}
                  onClick={handleRemoveMedia}
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <label
              style={{
                border: "2px dashed var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "20px 14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                background: "var(--bg-secondary)",
                transition: "all 0.2s ease",
              }}
            >
              <Upload size={22} color="var(--accent)" />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>
                Click to attach a Photo or Video
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                JPG, PNG, GIF, MP4 supported
              </div>
              <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFileChange} />
            </label>
          )}
        </div>

        {/* 3. Pinned Auto-Comment */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
            💬 Pinned First-Comment (Optional)
          </label>
          <textarea
            className="form-input"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Auto-comment with link (e.g. 👇 Check this out: https://...)"
            style={{ minHeight: 60, resize: "vertical", fontSize: 12.5 }}
          />
        </div>

        {/* 4. Target Pages */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
            👥 Target Facebook Pages ({selectedAccountIds.length} Selected)
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {accounts?.map(acc => {
              const isSelected = selectedAccountIds.includes(acc.id)
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => togglePage(acc.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: "var(--radius-xs)",
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    background: isSelected ? "rgba(24, 119, 242, 0.18)" : "var(--bg-secondary)",
                    border: `1px solid ${isSelected ? "#1877f2" : "var(--border)"}`,
                    color: isSelected ? "#38bdf8" : "var(--text-secondary)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontWeight: 800 }}>f</span> {acc.name}
                  {isSelected && <Check size={12} color="#38bdf8" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* 5. Schedule & Timing */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            ⏰ Release Schedule
          </label>

          {/* Quick Presets */}
          <div className="preset-chip-group" style={{ marginBottom: 10 }}>
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

          <input
            type="datetime-local"
            className="form-input"
            value={datetimeStr}
            min={minDatetimeStr}
            onChange={e => {
              setDatetimeStr(e.target.value)
              setActivePreset("custom")
            }}
          />
        </div>

        {/* Dynamic Countdown & Summary Banner */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(56, 189, 248, 0.04))",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Clock size={20} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              Scheduled for: {fullDateStr}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
              Releasing {countdown} • Synced to Facebook
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving || !caption.trim()}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {isSaving ? (
              <>
                <Loader size={15} className="spin" /> Saving Changes...
              </>
            ) : (
              <>
                <Check size={15} /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Queue({ embed = false }) {
  const { queue, removeFromQueue, updateQueueItem, clearQueue } = useQueue()
  const { addLog } = useLogs()
  const [previewItem, setPreviewItem] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const { accounts } = useAccounts()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [cancellingId, setCancellingId] = useState(null)
  const [, setTick] = useState(0)

  // Live countdown ticker every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 15000)
    return () => clearInterval(timer)
  }, [])

  // Auto-move published posts from Queue to Post History
  useEffect(() => {
    if (!queue?.length) return
    const now = Math.floor(Date.now() / 1000)

    queue.forEach(item => {
      // If post has passed its scheduled release time by at least 30 seconds, it's live on Facebook
      if (item.scheduledTime && (now - item.scheduledTime) >= 30) {
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
        removeFromQueue(item.id)
      }
    })
  }, [queue, addLog, removeFromQueue])

  // Auto-resolve missing image previews in background for list thumbnails
  const fetchedIdsRef = useRef(new Set())
  useEffect(() => {
    if (!queue?.length || !accounts?.length) return
    queue.forEach(item => {
      if (!item.mediaPreview && item.mediaType === "image" && !fetchedIdsRef.current.has(item.id)) {
        fetchedIdsRef.current.add(item.id)
        const postList = getPostIdsList(item)
        for (const postInfo of postList) {
          if (!postInfo?.postId) continue
          const token = getValidToken(accounts, postInfo.pageId)
          if (token) {
            axios.get(`${API_BASE}/post-media`, {
              params: { post_id: postInfo.postId, token }
            }).then(res => {
              if (res.data?.url) {
                updateQueueItem(item.id, { mediaPreview: res.data.url })
              }
            }).catch(() => {})
            break
          }
        }
      }
    })
  }, [queue, accounts, updateQueueItem])

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    return queue.filter(item => {
      const q = searchQuery.toLowerCase().trim()
      if (!q) return true
      return (
        item.caption?.toLowerCase().includes(q) ||
        item.targetAccountNames?.some(name => name.toLowerCase().includes(q))
      )
    })
  }, [queue, searchQuery])

  // Nearest release calculation
  const nextScheduled = useMemo(() => {
    const upcoming = queue
      .filter(item => item.scheduledTime && item.scheduledTime > Math.floor(Date.now() / 1000))
      .sort((a, b) => a.scheduledTime - b.scheduledTime)
    return upcoming[0] || null
  }, [queue])

  const handleDelete = async (item) => {
    if (!confirm(`Are you sure you want to cancel this scheduled post?\n\n"${item.caption?.slice(0, 50) || 'Post'}"`)) return

    setCancellingId(item.id)
    const postList = getPostIdsList(item)
    if (postList.length > 0) {
      try {
        for (const postInfo of postList) {
          if (!postInfo?.postId) continue
          const token = getValidToken(accounts, postInfo.pageId)
          if (token) {
            await axios.delete(`${API_BASE}/scheduled-posts/${postInfo.postId}`, {
              params: { token },
            })
          }
        }
      } catch (err) {
        console.warn("Could not delete from Facebook:", err)
      }
    }

    removeFromQueue(item.id)
    setCancellingId(null)
    toast("Scheduled post cancelled and removed", "info")
  }

  const handleClearAll = () => {
    if (confirm("Clear all scheduled items from your queue?")) {
      clearQueue()
      toast("Queue cleared", "info")
    }
  }

  return (
    <div>
      {/* Header */}
      {!embed ? (
        <div
          className="page-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="page-title">Automated Video Queue</h1>
              <span className="pill pill-info" style={{ fontSize: 11.5 }}>
                {queue.length} Post{queue.length !== 1 ? "s" : ""} Waiting
              </span>
            </div>
            <p className="page-subtitle">
              Videos and posts registered in Facebook's official schedule. They will publish automatically on time.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {queue.length > 0 && (
              <button className="btn btn-danger btn-sm" onClick={handleClearAll}>
                <Trash2 size={14} /> Clear All
              </button>
            )}
            <button className="btn btn-primary" onClick={() => navigate("/create")}>
              <Plus size={16} /> Schedule Another Video
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
            paddingBottom: 14,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Official Facebook Cloud Schedule:
            </span>
            <span className="pill pill-info" style={{ fontSize: 11.5 }}>
              {queue.length} Post{queue.length !== 1 ? "s" : ""} Waiting
            </span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {queue.length > 0 && (
              <button className="btn btn-danger btn-sm" onClick={handleClearAll}>
                <Trash2 size={13} /> Clear All
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/create")}>
              <Plus size={14} /> Schedule Another Video
            </button>
          </div>
        </div>
      )}



      {/* Top Metric Cards */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Waiting in Queue</div>
          <div className="stat-value">{queue.length}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
            <Layers size={13} /> Queued video releases
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Next Scheduled Release</div>
          <div className="stat-value" style={{ color: nextScheduled ? "var(--accent)" : "var(--text-muted)", fontSize: 22 }}>
            {nextScheduled ? getCountdown(nextScheduled.scheduledTime) : "None"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={13} />{" "}
            {nextScheduled
              ? new Date(nextScheduled.scheduledTime * 1000).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              : "Queue is currently empty"}
          </div>
        </div>


      </div>

      {/* Search Toolbar */}
      {queue.length > 0 && (
        <div style={{ marginBottom: 18, display: "flex", gap: 12, alignItems: "center" }}>
          <div className="search-filter-bar" style={{ minWidth: 280, flex: 1, maxWidth: 460 }}>
            <Search size={15} style={{ color: "var(--text-muted)" }} />
            <input
              className="search-filter-input"
              placeholder="Search queued posts by caption or target page..."
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
        </div>
      )}

      {/* Queue Items */}
      {queue.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div className="empty-state" style={{ padding: 0 }}>
            <div className="empty-state-icon" style={{ width: 64, height: 64, margin: "0 auto 16px" }}>
              <CalendarClock size={32} style={{ color: "var(--accent)" }} />
            </div>
            <div className="empty-state-title" style={{ fontSize: 20 }}>No Videos Currently in Queue</div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, maxWidth: 500, margin: "0 auto 24px", lineHeight: 1.6 }}>
              Queueing up your content allows you to prepare videos for the entire week. Facebook publishes them automatically at your target times.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, maxWidth: 640, margin: "0 auto 28px", textAlign: "left" }}>
              <div style={{ background: "var(--bg-secondary)", padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>1. Go to Create Post</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Drop your video file and write your caption</div>
              </div>
              <div style={{ background: "var(--bg-secondary)", padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>2. Pick "Schedule for Later"</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Choose a quick preset or exact date/time</div>
              </div>
              <div style={{ background: "var(--bg-secondary)", padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>3. Facebook Publishes It</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>No need to keep your PC awake!</div>
              </div>
            </div>

            <button className="btn btn-primary btn-lg" onClick={() => navigate("/create")}>
              <Plus size={18} /> Schedule Your First Video Now
            </button>
          </div>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="card" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
          <Search size={28} style={{ opacity: 0.3, marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>No queued posts match "{searchQuery}"</div>
          <p style={{ fontSize: 13, marginTop: 4 }}>Try searching for a different keyword or clear the search.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filteredQueue.map(item => {
            const isCancelling = cancellingId === item.id
            const dateStr = item.scheduledTime
              ? new Date(item.scheduledTime * 1000).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              : "Immediately"

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 18,
                  padding: "18px 20px",
                  flexWrap: "wrap",
                }}
              >
                {/* Media Icon & Details */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 280, flex: 1 }}>
                  {item.mediaPreview ? (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "var(--radius-sm)",
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        flexShrink: 0,
                        background: "#05070e",
                      }}
                    >
                      <img
                        src={item.mediaPreview}
                        alt="Thumbnail"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  ) : item.mediaType === "video" ? (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(99, 102, 241, 0.12)",
                        border: "1px solid rgba(99, 102, 241, 0.3)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--accent)",
                        flexShrink: 0,
                      }}
                    >
                      <FileVideo size={24} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, marginTop: 2, textTransform: "uppercase" }}>Video</span>
                    </div>
                  ) : item.mediaType === "image" ? (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(56, 189, 248, 0.12)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#38bdf8",
                        flexShrink: 0,
                      }}
                    >
                      <FileImage size={24} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, marginTop: 2, textTransform: "uppercase" }}>Image</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        flexShrink: 0,
                      }}
                    >
                      📝
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 440,
                      }}
                    >
                      {item.caption || "Untitled Post"}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <span className="platform-badge facebook" style={{ fontSize: 11, padding: "3px 8px" }}>
                        Pages: {item.targetAccountNames?.join(", ") || "Selected Pages"}
                      </span>
                      {item.mediaFilename && (
                        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                          📁 {item.mediaFilename}
                        </span>
                      )}
                      {item.comment && (
                        <span style={{ fontSize: 11.5, color: "var(--accent)" }}>
                          💬 Auto-comment pinned
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Release Schedule & Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Countdown Badge */}
                  {(() => {
                    const now = Math.floor(Date.now() / 1000)
                    const isPublished = item.scheduledTime && (item.scheduledTime - now) <= -60
                    return (
                      <div
                        style={{
                          textAlign: "right",
                          background: isPublished ? "rgba(16, 185, 129, 0.08)" : "var(--bg-secondary)",
                          padding: "8px 14px",
                          borderRadius: "var(--radius-sm)",
                          border: `1px solid ${isPublished ? "rgba(16, 185, 129, 0.3)" : "var(--border)"}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                          {isPublished ? (
                            <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                          ) : (
                            <Clock size={14} style={{ color: "var(--accent)" }} />
                          )}
                          <span
                            style={{
                              fontSize: 13.5,
                              fontWeight: 800,
                              color: isPublished ? "var(--success)" : "var(--accent)",
                            }}
                          >
                            {getCountdown(item.scheduledTime)}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                          {dateStr}
                        </div>
                      </div>
                    )
                  })()}

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPreviewItem(item)}
                    title="Preview Scheduled Post"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Eye size={14} /> Preview
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditItem(item)}
                    title="Edit scheduled post (caption, media, time, pages)"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Edit3 size={14} /> Edit
                  </button>

                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(item)}
                    disabled={isCancelling}
                    title="Cancel scheduled post on Facebook"
                  >
                    <Trash2 size={14} /> {isCancelling ? "Cancelling..." : "Cancel"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Preview Modal (View-Only) */}
      {previewItem && (
        <QueuePreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onDelete={handleDelete}
          accounts={accounts}
          onUpdateItem={updateQueueItem}
          onOpenEdit={item => setEditItem(item)}
        />
      )}

      {/* Comprehensive Edit Modal */}
      {editItem && (
        <QueueEditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          accounts={accounts}
          onUpdateItem={updateQueueItem}
          toast={toast}
        />
      )}
    </div>
  )
}
