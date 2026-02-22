import React from "react"
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"

import { App } from "./src/app"

const renderer = await createCliRenderer({
  targetFps: 30,
  useMouse: true,
  useConsole: false,
  exitOnCtrlC: true,
  onDestroy: () => process.exit(0),
})

createRoot(renderer).render(React.createElement(App))
