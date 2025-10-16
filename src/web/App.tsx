import { createEffect, createSignal, onMount, Show } from 'solid-js'
import ContentViewer from './components/ContentViewer'
import EntryTable from './components/EntryTable'
import GroupedEntryView from './components/GroupedEntryView'
import Sidebar from './components/Sidebar'
import { api, type VaultEntry } from './lib/api'
import {
  displayMode,
  searchQuery,
  setDisplayMode,
  setSearchQuery,
  setShowAllVersions,
  showAllVersions,
  viewMode,
} from './stores/ui'
import { selectedScope, setCurrentScope, setError, setLoading, setScopes } from './stores/vault'

export default function App() {
  const [scopeEntries, setScopeEntries] = createSignal<VaultEntry[]>([])

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
      const result = await api.getScopeEntries(scope, showAllVersions())
      setScopeEntries(result.entries || [])
    } catch (error) {
      console.error('Failed to load scope entries:', error)
      setScopeEntries([])
    }
  })

  function getFormattedScope(): string {
    const scope = selectedScope()
    if (!scope) return ''

    switch (scope.type) {
      case 'global':
        return 'global'
      case 'repository': {
        const parts = scope.primaryPath.split('/')
        return parts[parts.length - 1] || scope.primaryPath
      }
      case 'branch': {
        const parts = scope.primaryPath.split('/')
        const repoName = parts[parts.length - 1] || scope.primaryPath
        return `${repoName}:${scope.branchName}`
      }
      case 'worktree': {
        const parts = scope.primaryPath.split('/')
        const repoName = parts[parts.length - 1] || scope.primaryPath
        return `${repoName}@${scope.worktreeId}`
      }
    }
  }

  return (
    <div class="flex h-screen">
      <Sidebar />
      <div class="flex-1 flex flex-col">
        <Show when={viewMode() === 'table' && selectedScope()}>
          {/* Table View Header */}
          <div class="border-b border-base-300">
            <div class="p-4">
              <h2 class="text-xl font-semibold">Entries in {getFormattedScope()}</h2>
            </div>
            <div class="px-4 pb-3">
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
                <div class="join join-horizontal">
                  <button
                    type="button"
                    class={`btn btn-sm join-item ${displayMode() === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setDisplayMode('table')}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-4 h-4"
                    >
                      <title>Table view</title>
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.875c.621 0 1.125-.504 1.125-1.125m-9.375 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.875c-.621 0-1.125-.504-1.125-1.125m9.375-1.625V5.625m0 0c0-.621-.504-1.125-1.125-1.125H5.625c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h15.75c.621 0 1.125-.504 1.125-1.125v-1.5zm0 4.5H5.625m16.875 0c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H5.625c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h15.75zm0 4.5H5.625m16.875 0c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H5.625c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h15.75z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class={`btn btn-sm join-item ${displayMode() === 'grouped' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setDisplayMode('grouped')}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-4 h-4"
                    >
                      <title>Grouped view</title>
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Show>

        <div class="flex-1 overflow-auto">
          <Show when={viewMode() === 'table' && selectedScope()} fallback={<ContentViewer />}>
            <Show
              when={displayMode() === 'table'}
              fallback={<GroupedEntryView entries={scopeEntries()} scope={getFormattedScope()} />}
            >
              <EntryTable entries={scopeEntries()} scope={getFormattedScope()} />
            </Show>
          </Show>
        </div>
      </div>
    </div>
  )
}
