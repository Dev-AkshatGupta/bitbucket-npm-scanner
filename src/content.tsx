interface PackageInfo {
  name: string
  currentVersion: string
  latestVersion: string
  isOutdated: boolean
}

class BitbucketScanner {
  private processedElements = new Set<Element>()
  private cache = new Map<string, string>()

  constructor() {
    this.init()
  }

  private init() {
    // Wait for page to load and start observing
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.startScanning())
    } else {
      this.startScanning()
    }
  }

  private startScanning() {
    // Initial scan
    this.scanForPackageFiles()

    // Set up observer for dynamic content
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          shouldScan = true
        }
      })
      if (shouldScan) {
        setTimeout(() => this.scanForPackageFiles(), 500)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  private scanForPackageFiles() {
    // Look for package.json or package-lock.json files in diff view
    const diffElements = document.querySelectorAll('[data-testid="file-diff-view"]')

    diffElements.forEach((diffElement) => {
      if (this.processedElements.has(diffElement)) return

      const fileHeader = diffElement.querySelector('[data-testid="file-diff-header"]')
      if (!fileHeader) return

      const fileName = fileHeader.textContent || ""

      if (fileName.includes("package.json") || fileName.includes("package-lock.json")) {
        this.processedElements.add(diffElement)
        this.processPackageFile(diffElement)
      }
    })
  }

  private async processPackageFile(diffElement: Element) {
    const codeLines = diffElement.querySelectorAll('[data-testid="diff-line-content"]')

    for (const line of codeLines) {
      const lineText = line.textContent || ""

      // Look for package dependencies (added or modified lines)
      const packageMatch = lineText.match(/[+\s]*"([^"]+)":\s*"([^"]+)"/)
      if (packageMatch && this.isValidPackageName(packageMatch[1])) {
        const packageName = packageMatch[1]
        const currentVersion = packageMatch[2]

        // Skip if it's not a real package (like scripts, devDependencies keys, etc.)
        if (this.shouldSkipPackage(packageName)) continue

        try {
          const latestVersion = await this.getLatestVersion(packageName)
          if (latestVersion && latestVersion !== currentVersion) {
            this.addVersionIndicator(line, packageName, currentVersion, latestVersion)
          }
        } catch (error) {
          console.warn(`Failed to fetch version for ${packageName}:`, error)
        }
      }
    }
  }

  private isValidPackageName(name: string): boolean {
    // Basic validation for npm package names
    return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)
  }

  private shouldSkipPackage(packageName: string): boolean {
    const skipList = [
      "name",
      "version",
      "description",
      "main",
      "scripts",
      "keywords",
      "author",
      "license",
      "bugs",
      "homepage",
      "repository",
      "engines",
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]
    return skipList.includes(packageName)
  }

  private async getLatestVersion(packageName: string): Promise<string | null> {
    // Check cache first
    if (this.cache.has(packageName)) {
      return this.cache.get(packageName) || null
    }

    try {
      const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      const latestVersion = data.version

      // Cache the result
      this.cache.set(packageName, latestVersion)
      return latestVersion
    } catch (error) {
      console.warn(`Failed to fetch latest version for ${packageName}:`, error)
      return null
    }
  }

  private addVersionIndicator(
    lineElement: Element,
    packageName: string,
    currentVersion: string,
    latestVersion: string,
  ) {
    // Check if indicator already exists
    if (lineElement.querySelector(".npm-version-indicator")) return

    const indicator = document.createElement("span")
    indicator.className = "npm-version-indicator"
    indicator.innerHTML = `
      <span class="npm-latest-version" title="Latest version available on npm">
        📦 ${latestVersion}
      </span>
    `

    // Find the best position to insert the indicator
    const versionMatch = lineElement.textContent?.match(/"([^"]+)"\s*$/)
    if (versionMatch) {
      // Try to insert after the version string
      const textNodes = this.getTextNodes(lineElement)
      for (const textNode of textNodes) {
        if (textNode.textContent?.includes(currentVersion)) {
          const parent = textNode.parentElement || lineElement
          parent.appendChild(indicator)
          break
        }
      }
    } else {
      // Fallback: append to the line
      lineElement.appendChild(indicator)
    }
  }

  private getTextNodes(element: Element): Text[] {
    const textNodes: Text[] = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

    let node
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text)
    }
    return textNodes
  }
}

// Initialize the scanner
new BitbucketScanner()
