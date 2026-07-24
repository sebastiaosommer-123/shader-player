const STORAGE_KEY = "shader-player:collapsed-groups"

/**
 * Which parameter groups are collapsed, per shader.
 *
 * Collapsed rather than open on purpose: "everything expanded" is then the
 * empty state, so a fresh visitor stores nothing and a group added to a shader
 * config later shows up open instead of hidden.
 *
 * This lives in a module-level store rather than in each ParameterGroup because
 * the desktop sidebar and the mobile sheet are both mounted at once — MobileNav
 * renders ControlsSheet whatever the viewport — so the same group has two
 * component instances. Local state would let them drift apart and race each
 * other writing to localStorage.
 */
type CollapsedMap = Record<string, string[]>

let state: CollapsedMap | null = null
const listeners = new Set<() => void>()

function load(): CollapsedMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as CollapsedMap
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function save(next: CollapsedMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private mode / disabled storage: the layout just won't survive a reload.
  }
}

function read(): CollapsedMap {
  if (state === null) state = load()
  return state
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isCollapsed(shaderId: string, groupName: string) {
  return read()[shaderId]?.includes(groupName) ?? false
}

export function toggle(shaderId: string, groupName: string) {
  const current = read()
  const collapsed = current[shaderId] ?? []
  const next = collapsed.includes(groupName)
    ? collapsed.filter((name) => name !== groupName)
    : [...collapsed, groupName]

  state = { ...current, [shaderId]: next }
  // Drop shaders back to absent once everything is expanded again, so the
  // stored object stays as small as the state it describes.
  if (next.length === 0) delete state[shaderId]

  save(state)
  listeners.forEach((listener) => listener())
}
