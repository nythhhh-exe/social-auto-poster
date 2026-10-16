import { Routes, Route } from "react-router-dom"
import Sidebar from "./components/Sidebar"
import Dashboard from "./pages/Dashboard"
import CreatePost from "./pages/CreatePost"
import Accounts from "./pages/Accounts"
import History from "./pages/History"
import Settings from "./pages/Settings"
import WarmUp from "./pages/WarmUp"
import { ToastProvider } from "./context/ToastContext"
import { AccountsProvider } from "./context/AccountsContext"
import { LogsProvider } from "./context/LogsContext"

export default function App() {
  return (
    <AccountsProvider>
      <LogsProvider>
        <ToastProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/create" element={<CreatePost />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/warmup" element={<WarmUp />} />
                <Route path="/history" element={<History />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </div>
        </ToastProvider>
      </LogsProvider>
    </AccountsProvider>
  )
}
