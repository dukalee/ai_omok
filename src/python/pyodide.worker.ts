import { HARNESS_PY } from './harness'
import { PYODIDE_URL } from './protocol'
import type { WorkerIn, WorkerOut } from './protocol'
import { createPythonSession } from './session'
import type { PyodideLike } from './session'

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerIn>) => void) | null
  postMessage(message: WorkerOut): void
}

const scope = self as unknown as WorkerScope
let session: ReturnType<typeof createPythonSession> | null = null

const notReady = {
  ok: false as const,
  failure: { kind: 'internal' as const, message: 'Python이 아직 준비되지 않았습니다.' },
}

scope.onmessage = async (event) => {
  const message = event.data

  if (message.type === 'init') {
    try {
      // Pyodide는 CDN에서 불러온다. 번들러가 따라가지 않도록 @vite-ignore를 붙인다.
      const mod = await import(/* @vite-ignore */ PYODIDE_URL)
      const py = await mod.loadPyodide()
      py.runPython(HARNESS_PY)
      session = createPythonSession(py as PyodideLike)
      scope.postMessage({ type: 'ready' })
    } catch (error) {
      scope.postMessage({ type: 'init-error', message: `Python을 불러오지 못했습니다: ${String(error)}` })
    }
    return
  }

  if (message.type === 'load') {
    scope.postMessage({ type: 'loaded', result: session ? session.load(message.code) : notReady })
    return
  }

  if (message.type === 'choose') {
    scope.postMessage({
      type: 'chosen',
      id: message.id,
      result: session ? session.choose(message.state) : notReady,
    })
  }
}
