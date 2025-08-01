"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { chrome } from "chrome"

interface ExtensionStats {
  packagesScanned: number
  outdatedPackages: number
  lastScan: string
}

const Popup: React.FC = () => {
  const [stats, setStats] = useState<ExtensionStats>({
    packagesScanned: 0,
    outdatedPackages: 0,
    lastScan: "Never",
  })
  const [isEnabled, setIsEnabled] = useState(true)

  useEffect(() => {
    // Load stats from storage
    chrome.storage.local.get(["extensionStats", "isEnabled"], (result) => {
      if (result.extensionStats) {
        setStats(result.extensionStats)
      }
      if (result.isEnabled !== undefined) {
        setIsEnabled(result.isEnabled)
      }
    })
  }, [])

  const toggleExtension = () => {
    const newState = !isEnabled
    setIsEnabled(newState)
    chrome.storage.local.set({ isEnabled: newState })

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggleExtension",
          enabled: newState,
        })
      }
    })
  }

  const clearCache = () => {
    chrome.storage.local.clear(() => {
      setStats({
        packagesScanned: 0,
        outdatedPackages: 0,
        lastScan: "Never",
      })
    })
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h2>NPM Package Scanner</h2>
        <div className="toggle-container">
          <label className="toggle-switch">
            <input type="checkbox" checked={isEnabled} onChange={toggleExtension} />
            <span className="slider"></span>
          </label>
          <span>{isEnabled ? "Enabled" : "Disabled"}</span>
        </div>
      </div>

      <div className="stats-container">
        <div className="stat-item">
          <span className="stat-label">Packages Scanned:</span>
          <span className="stat-value">{stats.packagesScanned}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Outdated Found:</span>
          <span className="stat-value outdated">{stats.outdatedPackages}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Last Scan:</span>
          <span className="stat-value">{stats.lastScan}</span>
        </div>
      </div>

      <div className="actions-container">
        <button onClick={clearCache} className="clear-button">
          Clear Cache
        </button>
      </div>

      <div className="info-container">
        <p>
          This extension scans package.json and package-lock.json files in Bitbucket pull requests and shows the latest
          npm versions.
        </p>
      </div>
    </div>
  )
}

// Render the popup
const container = document.getElementById("root")
if (container) {
  const root = createRoot(container)
  root.render(<Popup />)
}
