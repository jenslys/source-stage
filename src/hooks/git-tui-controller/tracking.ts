import type { RepoSnapshot } from "../../git"

export function resolveTracking(snapshot: RepoSnapshot | null) {
  if (!snapshot) {
    return {
      loading: true,
      upstream: null,
      ahead: 0,
      behind: 0,
    }
  }

  return {
    loading: false,
    upstream: snapshot.upstream,
    ahead: snapshot.ahead,
    behind: snapshot.behind,
  }
}
