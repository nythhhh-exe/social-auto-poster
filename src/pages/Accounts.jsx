import { useState } from "react"
import { useAccounts } from "../context/AccountsContext"
import { useToast } from "../context/ToastContext"
import { Plus, Trash2, X, Check, ShieldCheck, Loader, Zap, Layers, RefreshCw } from "lucide-react"
import axios from "axios"

import { API_BASE } from "../config"

function BulkImportModal({ onClose, onImport, existingPageIds, initialToken }) {
  const [token, setToken] = useState(initialToken || "")
  const [proxy, setProxy] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetchedPages, setFetchedPages] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const handleFetch = async (e) => {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    setError("")
    setFetchedPages(null)
    setSelectedIds(new Set())

    try {
      const res = await axios.get(`${API_BASE}/fetch-pages`, {
        params: { token: token.trim() },
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

  const unimportedPages = fetchedPages ? fetchedPages.filter(p => !existingPageIds.has(String(p.pageId))) : []
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
        username: p.category ? `@${p.category.toLowerCase().replace(/[^a-z0-9]/g, '')}` : "",
        pageId: String(p.pageId),
        token: p.token,
        proxy: proxy.trim(),
        avatar: p.avatar,
      }))
    onImport(toImport, token.trim())
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560, maxWidth: "94vw" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={20} style={{ color: "var(--accent)" }} /> Bulk Import Pages
            </h2>
            <p className="modal-subtitle">Paste 1 Master User Token to auto-import all Pages at once</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleFetch} className="space-y-3">
          <div className="form-group">
            <label className="form-label">Master User Access Token *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="form-input"
                type="password"
                placeholder="EAAGm0P..."
                value={token}
                onChange={e => setToken(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading || !token.trim()}>
                {loading ? <Loader size={14} className="spin" /> : <Layers size={14} />}
                {loading ? "Fetching..." : "Fetch Pages"}
              </button>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Get from <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>Graph Explorer</a> with <code>pages_show_list, pages_read_engagement, pages_manage_posts</code>
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Proxy for all imported pages (Optional)</label>
            <input
              className="form-input"
              placeholder="http://user:pass@ip:port"
              value={proxy}
              onChange={e => setProxy(e.target.value)}
            />
          </div>
        </form>

        {error && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", color: "var(--danger)", fontSize: 13 }}>
            ❌ {error}
          </div>
        )}

        {fetchedPages && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                Found {fetchedPages.length} {fetchedPages.length === 1 ? "Page" : "Pages"}
              </span>
              {unimportedPages.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                >
                  {allSelected ? "Deselect All" : "Select All Unimported"}
                </button>
              )}
            </div>

            {fetchedPages.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
                No Facebook Pages found under this token. Make sure the token has <code>pages_show_list</code> permission.
              </div>
            ) : (
              <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
                {fetchedPages.map(page => {
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
                        padding: "10px 12px",
                        background: isChecked ? "var(--accent-soft)" : "var(--bg-secondary)",
                        border: `1px solid ${isChecked ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: "var(--radius-sm)",
                        cursor: isExisting ? "default" : "pointer",
                        opacity: isExisting ? 0.6 : 1,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isExisting}
                        onChange={() => {}}
                        style={{ cursor: isExisting ? "default" : "pointer", accentColor: "var(--accent)", width: 16, height: 16 }}
                      />
                      {page.avatar ? (
                        <img src={page.avatar} alt={page.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
                          {page.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {page.name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          ID: {page.pageId} • {page.fans?.toLocaleString() ?? 0} followers
                        </div>
                      </div>
                      {isExisting && (
                        <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--border)", color: "var(--text-secondary)", borderRadius: 10, fontWeight: 600 }}>
                          Already Added
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
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
        <h2 className="modal-title">Add Facebook Account</h2>
        <p className="modal-subtitle">Connect a single Facebook Page using its access token</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Page Name *</label>
            <input className="form-input" placeholder="e.g. My Business Page" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Username / Handle (Optional)</label>
            <input className="form-input" placeholder="e.g. @mybizpage (display only)" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Optional display label for your dashboard</span>
          </div>
          <div className="form-group">
            <label className="form-label">Page ID *</label>
            <input className="form-input" placeholder="e.g. 102938475610293" value={form.pageId} onChange={e => setForm(p => ({ ...p, pageId: e.target.value }))} required />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Numeric ID: Found in Page &gt; About &gt; Page transparency</span>
          </div>
          <div className="form-group">
            <label className="form-label">Page Access Token *</label>
            <input className="form-input" type="password" placeholder="EAAGm0P..." value={form.token} onChange={e => setForm(p => ({ ...p, token: e.target.value }))} required />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Get from <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>Meta Graph API Explorer</a> (Page Token)
            </span>
          </div>
          <div className="form-group">
            <label className="form-label">Proxy (Optional)</label>
            <input className="form-input" placeholder="http://user:pass@ip:port" value={form.proxy} onChange={e => setForm(p => ({ ...p, proxy: e.target.value }))} />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary"><Check size={14} /> Add Account</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Accounts() {
  const { accounts, masterToken, setMasterToken, addAccount, addAccounts, syncPages, removeAccount } = useAccounts()
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [validating, setValidating] = useState({})

  const existingPageIds = new Set(accounts.map(a => String(a.pageId)))

  const handleAdd = (acc) => {
    addAccount(acc)
    toast("Account added successfully!", "success")
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
      toast(`✅ Valid! "${data.page_name}" — ${data.fans?.toLocaleString() ?? "?"} followers`, "success")
    } catch (err) {
      const msg = err.response?.data?.detail || "Token invalid or expired"
      toast(`❌ ${msg}`, "error")
    } finally {
      setValidating(v => ({ ...v, [acc.id]: false }))
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">Manage your connected social media accounts</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={handleQuickSync} disabled={syncing}>
            <RefreshCw size={15} className={syncing ? "spin" : ""} style={{ color: "var(--accent)" }} />
            {syncing ? "Syncing..." : "Sync New Pages"}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
            <Zap size={16} style={{ color: "var(--accent)" }} /> Bulk Import
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Single Page
          </button>
        </div>
      </div>

      <div className="card mb-4" style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 20 }}>{accounts.length}</span> Total accounts
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            <span style={{ fontWeight: 700, color: "var(--success)", fontSize: 20 }}>{accounts.filter(a => a.status === "active").length}</span> Active
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            <span style={{ fontWeight: 700, color: "var(--danger)", fontSize: 20 }}>{accounts.filter(a => a.status === "expired").length}</span> Expired
          </div>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No accounts connected</div>
            <p style={{ fontSize: 13, marginBottom: 16 }}>Import all your Facebook Pages at once or add them individually</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn btn-secondary" onClick={handleQuickSync} disabled={syncing}>
                <RefreshCw size={15} className={syncing ? "spin" : ""} style={{ color: "var(--accent)" }} />
                {syncing ? "Syncing..." : "Sync New Pages"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
                <Zap size={16} style={{ color: "var(--accent)" }} /> Bulk Import
              </button>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                <Plus size={16} /> Add Single Page
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px,1fr))", gap: 14 }}>
          {accounts.map(acc => (
            <div key={acc.id} className="account-card" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="account-avatar">{acc.name[0].toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div className="account-name">{acc.name}</div>
                  <div className="account-platform">{acc.username || "No handle set"}</div>
                </div>
                <div className="account-status">
                  <div className={`status-dot ${acc.status}`} />
                  <span style={{ color: acc.status === "active" ? "var(--success)" : "var(--danger)", fontSize: 11, textTransform: "capitalize" }}>{acc.status}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="platform-badge facebook">
                  <span>f</span> Facebook Page
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "3px 8px" }}>
                  ID: {acc.pageId}
                </span>
                {acc.proxy && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "3px 8px" }}>
                    🔒 Proxy set
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleValidate(acc)}
                  disabled={validating[acc.id]}
                >
                  {validating[acc.id] ? <Loader size={13} className="spin" /> : <ShieldCheck size={13} />}
                  {validating[acc.id] ? "Checking..." : "Validate"}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleRemove(acc.id, acc.name)}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
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
