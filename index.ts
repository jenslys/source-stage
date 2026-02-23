import React from "react"
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"

import { App } from "./src/app"
import { loadStageConfig } from "./src/config"

const resolvedConfig = await loadStageConfig(process.cwd()).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Failed to load stage config: ${message}`)
  process.exit(1)
})

const renderer = await createCliRenderer({
  targetFps: 30,
  useMouse: true,
  useConsole: false,
  exitOnCtrlC: false,
  onDestroy: () => process.exit(0),
})

createRoot(renderer).render(React.createElement(App, { config: resolvedConfig.config }))
