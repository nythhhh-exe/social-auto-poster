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
    const addedList = []
    setAccounts(prev => {
      const existingIds = new Set(prev.map(a => String(a.pageId)))
      const toAdd = []
      newAccounts.forEach((acc, idx) => {
        if (!existingIds.has(String(acc.pageId))) {
          existingIds.add(String(acc.pageId))
          const item = {
            ...acc,
            id: Date.now() + idx,
            platform: "facebook",
            status: "active",
          }
          toAdd.push(item)
          addedList.push(item)
          addedCount++
        }
      })
      return [...prev, ...toAdd]
    })
    return { addedCount, addedList }
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
      syncPages,
      removeAccount,
      updateAccount,
    }}>
      {children}
    </AccountsContext.Provider>
  )
}

export const useAccounts = () => useContext(AccountsContext)
