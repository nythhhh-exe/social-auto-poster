import { useState, useCallback } from "react"
import { useAccounts } from "../context/AccountsContext"
import { useLogs } from "../context/LogsContext"
import { useToast } from "../context/ToastContext"
import { X, Send, Loader, CheckCircle, XCircle, Image, Video } from "lucide-react"
import { useDropzone } from "react-dropzone"
import axios from "axios"

import { API_BASE } from "../config"

function AccountSelector({ accounts, selected, onToggle }) {
  const allSelected = accounts.length > 0 && accounts.every(a => selected.includes(a.id))

  const toggleAll = () => {
    if (allSelected) onToggle(null, true) 
    else accounts.forEach(a => { if (!selected.includes(a.id)) onToggle(a.id) })
  }

  return (
    <div className="form-group">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label className="form-label">Post To Accounts</label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={toggleAll}>
          {allSelected ? "Deselect All" : "Select All"}
        </button>
      </div>
      {accounts.length === 0 ? (
        <div className="card" style={{ padding: 16, textAlign: "center", color: "var(--text-muted)" }}>
          No accounts connected. <a href="/accounts" style={{ color: "var(--accent)" }}>Add one first</a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {accounts.map(acc => (
            <div
              key={acc.id}
              className={`account-card${selected.includes(acc.id) ? " selected" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => onToggle(acc.id)}
            >
              <div className="account-avatar">{acc.name[0]}</div>
              <div>
                <div className="account-name">{acc.name}</div>
                <div className="account-platform">{acc.username} • Facebook</div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                {selected.includes(acc.id) ? (
                  <CheckCircle size={18} color="var(--accent)" />
                ) : (
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--border-light)" }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PostResult({ results }) {
  return (
    <div className="card mt-4">
      <div className="card-header">
        <span className="card-title">Post Results</span>
      </div>
      <div className="space-y-3">
        {results.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            {r.status === "success" ? <CheckCircle size={18} color="var(--success)" /> : r.status === "pending" ? <Loader size={18} className="spin" color="var(--accent)" /> : <XCircle size={18} color="var(--danger)" />}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{r.accountName}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.message}</div>
            </div>
            <span className={`pill pill-${r.status === "success" ? "success" : r.status === "pending" ? "info" : "danger"}`}>
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CreatePost() {
  const { accounts } = useAccounts()
  const { addLog } = useLogs()
  const toast = useToast()

  const [caption, setCaption] = useState("")
  const [comment, setComment] = useState("")
  const [delay, setDelay] = useState(3)
  const [media, setMedia] = useState(null)
  const [selectedAccounts, setSelectedAccounts] = useState([])
  const [posting, setPosting] = useState(false)
  const [results, setResults] = useState(null)

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

  const handlePost = async () => {
    if (!caption.trim()) { toast("Please write a caption!", "error"); return }
    if (selectedAccounts.length === 0) { toast("Select at least one account!", "error"); return }

    setPosting(true)
    const targetAccounts = accounts.filter(a => selectedAccounts.includes(a.id))

    // Set all to pending
    setResults(targetAccounts.map(acc => ({
      accountId: acc.id, accountName: acc.name, status: "pending", message: "Posting..."
    })))

    try {
      const formData = new FormData()
      formData.append("caption", caption)
      formData.append("comment", comment)
      formData.append("delay", String(delay))
      formData.append("accounts", JSON.stringify(targetAccounts))
      if (media?.file) {
        formData.append("media", media.file, media.file.name)
      }

      const { data } = await axios.post(`${API_BASE}/post`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      setResults(data.results)
      data.results.forEach(r => addLog({ ...r, caption: caption.slice(0, 60), comment }))

      const { success, total } = data.summary
      if (success === total) toast(`✅ Posted to all ${success} accounts!`, "success")
      else toast(`Posted to ${success}/${total} accounts`, "info")

    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Backend error"
      toast(`❌ ${msg}`, "error")
      setResults(prev => prev.map(r => ({ ...r, status: "error", message: msg })))
    }

    setPosting(false)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Create Post</h1>
        <p className="page-subtitle">Upload media, write caption, and auto-comment your link</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><span className="card-title">📸 Media</span></div>
            {!media ? (
              <div {...getRootProps()} className={`dropzone${isDragActive ? " active" : ""}`}>
                <input {...getInputProps()} />
                <div style={{ fontSize: 40, marginBottom: 10 }}>🖼️</div>
                <div className="dropzone-text">
                  <strong>Click or drag</strong> a photo or video here
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                  JPG, PNG, GIF, MP4 supported
                </div>
              </div>
            ) : (
              <div className="media-preview">
                {media.type === "image" ? (
                  <img src={media.url} alt="preview" />
                ) : (
                  <video src={media.url} controls />
                )}
                <button className="media-preview-remove" onClick={() => setMedia(null)}>
                  <X size={14} />
                </button>
                <div style={{ padding: "8px 12px", background: "var(--bg-secondary)", fontSize: 12, color: "var(--text-muted)" }}>
                  {media.type === "image" ? <Image size={12} /> : <Video size={12} />} {media.file.name}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">✍️ Caption</span></div>
            <div className="form-group">
              <textarea
                className="form-input"
                placeholder="Write your post caption here... Use emojis! 🔥"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                style={{ minHeight: 120 }}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>{caption.length} chars</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">💬 Auto-Comment</span></div>
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">Comment Text (with your link)</label>
                <textarea
                  className="form-input"
                  placeholder="👇 Check this out: https://yourlink.com"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  style={{ minHeight: 70 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Delay before commenting (seconds)</label>
                <input
                  type="number"
                  className="form-input"
                  value={delay}
                  onChange={e => setDelay(e.target.value)}
                  min={1}
                  max={60}
                  style={{ maxWidth: 120 }}
                />
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  ⏱ Wait {delay}s after posting before adding comment (looks more human)
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <AccountSelector accounts={accounts} selected={selectedAccounts} onToggle={toggleAccount} />
          </div>

          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Ready to post to:</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
                {selectedAccounts.length} account{selectedAccounts.length !== 1 ? "s" : ""}
              </div>
            </div>
            <button
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
              onClick={handlePost}
              disabled={posting || !caption.trim() || selectedAccounts.length === 0}
            >
              {posting ? <><Loader size={16} className="spin" /> Posting...</> : <><Send size={16} /> Post Now</>}
            </button>
            {posting && (
              <div style={{ marginTop: 12 }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: "60%" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>
                  Posting to accounts...
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: "14px 20px", borderColor: "var(--border-light)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>⚡ FLOW</div>
            <div className="space-y-3" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              <div>1️⃣ Upload media + caption</div>
              <div>2️⃣ Select accounts to post to</div>
              <div>3️⃣ All accounts post in parallel</div>
              <div>4️⃣ Wait {delay}s after each post</div>
              <div>5️⃣ Auto-comment your link 💬</div>
            </div>
          </div>
        </div>
      </div>

      {results && <PostResult results={results} />}
    </div>
  )
}
