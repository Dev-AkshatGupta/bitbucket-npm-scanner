// Background script for the Chrome extension
const chrome = window.chrome // Declare the chrome variable

chrome.runtime.onInstalled.addListener(() => {
  console.log("Bitbucket NPM Scanner extension installed")
})

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateStats") {
    // Update extension stats
    chrome.storage.local.set({
      extensionStats: {
        packagesScanned: request.packagesScanned,
        outdatedPackages: request.outdatedPackages,
        lastScan: new Date().toLocaleString(),
      },
    })
  }

  if (request.action === "fetchPackageVersion") {
    // Fetch package version from npm registry
    fetch(`https://registry.npmjs.org/${request.packageName}/latest`)
      .then((response) => response.json())
      .then((data) => {
        sendResponse({ version: data.version })
      })
      .catch((error) => {
        console.error("Error fetching package version:", error)
        sendResponse({ error: error.message })
      })

    return true // Keep message channel open for async response
  }
})

// Handle tab updates to reinject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && tab.url.includes("bitbucket.org")) {
    // Check if this is a pull request page
    if (tab.url.includes("/pull-requests/")) {
      chrome.storage.local.get(["isEnabled"], (result) => {
        if (result.isEnabled !== false) {
          // Extension is enabled, content script should be active
          chrome.tabs.sendMessage(tabId, { action: "checkStatus" }, (response) => {
            if (chrome.runtime.lastError) {
              // Content script not responding, might need to reload
              console.log("Content script not responding on tab:", tabId)
            }
          })
        }
      })
    }
  }
})
