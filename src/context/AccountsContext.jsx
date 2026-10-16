import { createContext, useContext, useState, useEffect } from "react"
import axios from "axios"

import { API_BASE } from "../config"

const AccountsContext = createContext(null)

export function AccountsProvider({ children }) {
  const [accounts, setAccounts] = useState(() => {
    const saved = localStorage.getItem("sap_accounts")
    return saved ? JSON.parse(saved) : []
  })

  const [masterToken, setMasterTokenState] = useState(() => {
    return localStorage.getItem("sap_master_token") || ""
  })

  useEffect(() => {
    localStorage.setItem("sap_accounts", JSON.stringify(accounts))
  }, [accounts])

  const setMasterToken = (token) => {
    const clean = (token || "").trim()
    setMasterTokenState(clean)
    if (clean) {
      localStorage.setItem("sap_master_token", clean)
    } else {
      localStorage.removeItem("sap_master_token")
    }
  }

  const addAccount = (account) => {
    const newAcc = { ...account, id: Date.now() }
    setAccounts(prev => [...prev, newAcc])
    return newAcc
  }

  const addAccounts = (newAccounts) => {
    let addedCount = 0
    let updatedCount = 0
    const addedList = []
    setAccounts(prev => {
      const existingById = new Map()
      const existingByName = new Map()
      prev.forEach(a => {
        existingById.set(String(a.pageId), a)
        if (a.name) existingByName.set(a.name.toLowerCase().trim(), a)
      })

      const toAdd = []
      const updatedMap = new Map()

      newAccounts.forEach((acc, idx) => {
        const idKey = String(acc.pageId)
        const nameKey = (acc.name || "").toLowerCase().trim()

        // Match by Page ID or Page Name
        const existing = existingById.get(idKey) || existingByName.get(nameKey)

        if (existing) {
          // Merge: keep real token if available, keep avatar, merge permanent status
          const hasRealToken = existing.token && existing.token !== "browser_session"
          const merged = {
            ...existing,
            ...acc,
            id: existing.id,
            pageId: hasRealToken ? existing.pageId : (acc.pageId || existing.pageId),
            token: hasRealToken ? existing.token : (acc.token || existing.token),
            avatar: existing.avatar || acc.avatar || null,
            fans: Math.max(existing.fans || 0, acc.fans || 0),
            isPermanent: existing.isPermanent || acc.isPermanent || false,
            delegateId: acc.pageId !== existing.pageId ? acc.pageId : existing.delegateId,
            status: "active",
          }
          updatedMap.set(existing.id, merged)
          updatedCount++
        } else {
          const item = {
            ...acc,
            id: Date.now() + idx,
            platform: "facebook",
            status: "active",
          }
          toAdd.push(item)
          addedList.push(item)
          addedCount++
          existingById.set(idKey, item)
          if (nameKey) existingByName.set(nameKey, item)
        }
      })

      return prev.map(a => updatedMap.get(a.id) || a).concat(toAdd)
    })
    return { addedCount, updatedCount, addedList }
  }

  const deduplicateAccounts = () => {
    let removedCount = 0
    setAccounts(prev => {
      const groups = new Map()
      prev.forEach(acc => {
        const key = (acc.name || "").toLowerCase().trim()
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(acc)
      })

      const result = []
      groups.forEach((list) => {
        if (list.length === 1) {
          result.push(list[0])
        } else {
          // Multiple accounts with same name: merge into single best account
          const tokenAcc = list.find(a => a.token && a.token !== "browser_session")
          const avatarAcc = list.find(a => a.avatar)
          const primary = tokenAcc || list[0]

          const merged = {
            ...primary,
            avatar: avatarAcc?.avatar || primary.avatar || null,
            fans: Math.max(...list.map(a => a.fans || 0)),
            isPermanent: list.some(a => a.isPermanent),
            status: "active",
          }
          result.push(merged)
          removedCount += (list.length - 1)
        }
      })
      return result
    })
    return removedCount
  }

  const syncPages = async (tokenOverride) => {
    const token = tokenOverride || masterToken
    if (!token) throw new Error("No Master Token saved yet. Please enter a token first.")

    const res = await axios.get(`${API_BASE}/fetch-pages`, {
      params: { token: token.trim() },
    })

    const fetched = res.data.pages || []
    const toImport = fetched.map(p => ({
      name: p.name,
      username: p.category ? `@${p.category.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "",
      pageId: String(p.pageId),
      token: p.token,
      avatar: p.avatar,
    }))

    const { addedCount, addedList } = addAccounts(toImport)
    return { totalFound: fetched.length, addedCount, addedList }
  }

  const removeAccount = (id) => setAccounts(prev => prev.filter(a => a.id !== id))

  const updateAccount = (id, updates) => setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))

  return (
    <AccountsContext.Provider value={{
      accounts,
      masterToken,
      setMasterToken,
      addAccount,
      addAccounts,
      deduplicateAccounts,
      syncPages,
      removeAccount,
      updateAccount,
    }}>
      {children}
    </AccountsContext.Provider>
  )
}

export const useAccounts = () => useContext(AccountsContext)
