import { ChevronRight, MapPin } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { allScopesCollapsed, setAllScopesCollapsed, setViewMode } from '../stores/ui'
import { currentScope, groupedScopes, loading, setSelectedScope } from '../stores/vault'
import ScopeTree from './ScopeTree'

export default function Sidebar() {
  function getCurrentScopeDisplay() {
    const current = currentScope()

    if (!current) return null

    // Parse current scope to find matching repository and branch
    const groups = groupedScopes()
    for (const group of groups) {
      for (const branch of group.branches) {
        if (branch.scope === current) {
          return {
            displayName: group.displayName,
            branchName: branch.branchName,
            primaryPath: group.primaryPath,
            isGlobal: group.primaryPath === 'global',
          }
        }
      }
    }

    return null
  }

  function selectCurrentScope() {
    const display = getCurrentScopeDisplay()
    if (display) {
      setSelectedScope({ primaryPath: display.primaryPath, branchName: display.branchName })
      setViewMode('table')
    }
  }

  return (
    <div class="w-80 bg-base-100 border-r border-base-300 overflow-y-auto">
      <div class="p-4 border-b border-base-200">
        <h1 class="text-xl font-semibold text-base-content flex items-center gap-2">
          <svg aria-hidden="true" class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            ></path>
          </svg>
          vault.md
        </h1>
        <p class="text-base text-base-content/60 mt-1">Knowledge vault for AI development</p>
      </div>

      <Show
        when={!loading()}
        fallback={
          <div class="flex justify-center items-center p-8">
            <span class="loading loading-spinner loading-md"></span>
          </div>
        }
      >
        <div class="px-2 pb-4">
          {/* Current Scope Section */}
          <Show when={getCurrentScopeDisplay()}>
            {(display) => (
              <div class="mb-3">
                <div class="text-sm font-semibold text-base-content/60 uppercase tracking-wider px-3 py-1 flex items-center">
                  <MapPin class="w-4 h-4 mr-2" /> Current
                </div>
                <button
                  type="button"
                  onClick={selectCurrentScope}
                  class="btn btn-ghost w-full justify-start normal-case text-primary h-auto min-h-[2.5rem] py-2"
                >
                  <span class="font-medium text-base">{display().displayName}</span>
                  <Show when={!display().isGlobal}>
                    <span class="text-base text-base-content/60">({display().branchName})</span>
                  </Show>
                </button>
              </div>
            )}
          </Show>

          {/* All Scopes Section */}
          <div>
            <button
              type="button"
              onClick={() => setAllScopesCollapsed(!allScopesCollapsed())}
              class="w-full text-sm font-semibold text-base-content/60 uppercase tracking-wider px-3 py-2 flex items-center justify-between hover:bg-base-200 rounded"
            >
              <span>All Scopes</span>
              <ChevronRight class={`w-4 h-4 transition-transform ${allScopesCollapsed() ? '' : 'rotate-90'}`} />
            </button>

            <Show when={!allScopesCollapsed()}>
              <div class="mt-2">
                <For each={groupedScopes()}>{(repository) => <ScopeTree repository={repository} />}</For>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
