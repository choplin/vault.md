import { createEffect, onMount, Show } from 'solid-js'
import ContentViewer from './components/ContentViewer'
import EntryTable from './components/EntryTable'
import Sidebar from './components/Sidebar'
import { api, type VaultEntry } from './lib/api'
import { searchQuery, setSearchQuery, setShowAllVersions, showAllVersions, viewMode } from './stores/ui'
import { groupedScopes, selectedScope, setCurrentScope, setError, setLoading, setScopes } from './stores/vault'

export default function App() {
  let scopeEntries: () => VaultEntry[] = () => []

  onMount(async () => {
    try {
      const currentScope = await api.getCurrentScope()
      setCurrentScope(currentScope)

      const data = await api.getAllEntries()
      setScopes(data.scopes || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  })

  // Load entries when scope is selected
  createEffect(async () => {
    const scope = selectedScope()
    if (!scope) return

    try {
      await api.getScopeEntries(scope.identifier, scope.branch, showAllVersions())

      // Find the matching scope in grouped data to get entries
      const groups = groupedScopes()
      for (const group of groups) {
        for (const branch of group.branches) {
          if (group.identifier === scope.identifier && branch.branch === scope.branch) {
            scopeEntries = () => branch.entries
            break
          }
        }
      }
    } catch (error) {
      console.error('Failed to load scope entries:', error)
    }
  })

  function getCurrentScopeString(): string {
    const scope = selectedScope()
    if (!scope) return ''

    const groups = groupedScopes()
    for (const group of groups) {
      for (const branch of group.branches) {
        if (group.identifier === scope.identifier && branch.branch === scope.branch) {
          return branch.scope
        }
      }
    }

    return ''
  }

  return (
    <div class="flex h-screen">
      <Sidebar />
      <div class="flex-1 flex flex-col">
        <Show when={viewMode() === 'table' && selectedScope()}>
          {/* Table View Header */}
          <div class="border-b border-base-300 p-4">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">Entries in {getCurrentScopeString()}</h2>
              <div class="flex items-center gap-4">
                <label class="input input-bordered input-sm flex items-center gap-2">
                  <input
                    type="text"
                    class="grow"
                    placeholder="Search..."
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    class="h-4 w-4 opacity-70"
                  >
                    <title>Search</title>
                    <path
                      fill-rule="evenodd"
                      d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </label>
                <label class="label cursor-pointer">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm mr-2"
                    checked={showAllVersions()}
                    onChange={(e) => setShowAllVersions(e.currentTarget.checked)}
                  />
                  <span class="label-text">Show all versions</span>
                </label>
              </div>
            </div>
          </div>
        </Show>

        <div class="flex-1 overflow-auto">
          <Show when={viewMode() === 'table' && selectedScope()} fallback={<ContentViewer />}>
            <EntryTable entries={scopeEntries()} scope={getCurrentScopeString()} />
          </Show>
        </div>
      </div>
    </div>
  )
}
