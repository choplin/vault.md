import { Check, ChevronRight, Folder, GitBranch, Globe } from 'lucide-solid'
import { createSignal, For, Show } from 'solid-js'
import { api, deleteScope, type ScopePayload } from '../lib/api'
import { scopeEquals } from '../lib/grouping'
import { collapsedRepos, setViewMode, toggleRepoCollapse } from '../stores/ui'
import type { RepositoryGroup } from '../stores/vault'
import { currentScope, refreshEntries, setSelectedScope } from '../stores/vault'

interface ScopeTreeProps {
  repository: RepositoryGroup
}

export default function ScopeTree(props: ScopeTreeProps) {
  const [deleteConfirm, setDeleteConfirm] = createSignal<{
    type: 'scope' | 'identifier'
    branchName?: string
    scope?: ScopePayload
  } | null>(null)
  const [deleting, setDeleting] = createSignal(false)

  const isCollapsed = () => collapsedRepos().has(props.repository.primaryPath)
  const isGlobal = () => props.repository.primaryPath === 'global'

  const repositoryScope: ScopePayload = isGlobal()
    ? { type: 'global' }
    : { type: 'repository', primaryPath: props.repository.primaryPath }

  function toggleCollapse() {
    if (!isGlobal()) {
      toggleRepoCollapse(props.repository.primaryPath)
    }
  }

  async function selectScope(scope: ScopePayload) {
    setSelectedScope(scope)
    setViewMode('table')

    // Load entries for this scope
    try {
      await api.getScopeEntries(scope)
      // This will be handled by the parent component watching selectedScope
    } catch (error) {
      console.error('Failed to load scope entries:', error)
    }
  }

  function isCurrentScope(scope: ScopePayload): boolean {
    const current = currentScope()
    return scopeEquals(current, scope)
  }

  return (
    <div class="mb-1">
      {/* Repository header */}
      <Show
        when={!isGlobal()}
        fallback={
          // Global scope - direct clickable item
          <button
            type="button"
            onClick={() => selectScope(props.repository.branches[0]?.scope || { type: 'global' })}
            class={`btn btn-ghost w-full justify-start normal-case h-auto min-h-[2.5rem] py-2 ${
              isCurrentScope(props.repository.branches[0]?.scope || { type: 'global' }) ? 'btn-active' : ''
            }`}
          >
            <Globe class="w-5 h-5 mr-2 flex-shrink-0 text-base-content/60" />
            <span class="font-medium text-base text-base-content truncate">{props.repository.displayName}</span>
            <span
              class={`ml-auto badge ${
                isCurrentScope(props.repository.branches[0]?.scope || { type: 'global' }) ? 'badge-primary' : ''
              }`}
            >
              {props.repository.branches[0]?.entries.length || 0}
            </span>
          </button>
        }
      >
        {/* Repository with branches */}
        <div class="flex items-center">
          <button
            type="button"
            onClick={toggleCollapse}
            class="btn btn-ghost flex-1 justify-start normal-case h-auto min-h-[2.5rem] py-2"
          >
            <ChevronRight
              class={`w-5 h-5 mr-1 flex-shrink-0 transition-transform text-base-content/40 ${
                !isCollapsed() ? 'rotate-90' : ''
              }`}
            />
            <Folder class="w-5 h-5 mr-2 flex-shrink-0 text-base-content/60" />
            <span class="font-medium text-base text-base-content truncate">{props.repository.displayName}</span>
            <span class={`ml-auto badge`}>
              {props.repository.branches.reduce((sum, branch) => sum + branch.entries.length, 0)}
            </span>
          </button>
          <div class="dropdown dropdown-end">
            <button type="button" tabindex="0" class="btn btn-ghost btn-xs ml-1" onClick={(e) => e.stopPropagation()}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-4 h-4"
                role="img"
                aria-label="More options"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                />
              </svg>
            </button>
            <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
              <li>
                <button type="button" onClick={() => setDeleteConfirm({ type: 'identifier', scope: repositoryScope })}>
                  Delete entire vault
                </button>
              </li>
            </ul>
          </div>
        </div>
      </Show>

      {/* Branches */}
      <Show when={!isGlobal() && !isCollapsed()}>
        <div class="ml-6 mt-1">
          <For each={props.repository.branches}>
            {(branch) => (
              <div class="flex items-center">
                <button
                  type="button"
                  onClick={() => selectScope(branch.scope)}
                  class={`btn btn-ghost flex-1 justify-start normal-case h-auto min-h-[2.5rem] py-2 ${
                    isCurrentScope(branch.scope) ? 'btn-active' : ''
                  }`}
                >
                  <GitBranch class="w-5 h-5 mr-2 flex-shrink-0 text-base-content/60" />
                  <span class="font-medium text-base text-base-content truncate">{branch.branchName}</span>
                  <Show when={isCurrentScope(branch.scope)}>
                    <Check class="w-4 h-4 ml-2 text-primary" />
                  </Show>
                  <span class={`ml-auto badge ${isCurrentScope(branch.scope) ? 'badge-primary' : ''}`}>
                    {branch.entries.length}
                  </span>
                </button>
                <div class="dropdown dropdown-end">
                  <button
                    type="button"
                    tabindex="0"
                    class="btn btn-ghost btn-xs ml-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="w-4 h-4"
                      role="img"
                      aria-label="More options"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                      />
                    </svg>
                  </button>
                  <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                    <li>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteConfirm({ type: 'scope', branchName: branch.branchName, scope: branch.scope })
                        }
                      >
                        Delete vault for this branch
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Delete confirmation modal */}
      <Show when={deleteConfirm()}>
        {(confirm) => (
          <div class="modal modal-open" role="dialog" aria-modal="true">
            <div class="modal-box">
              <h3 class="font-bold text-lg">Confirm Deletion</h3>
              <p class="py-4">
                {confirm().type === 'scope'
                  ? `Delete vault for branch '${confirm().branchName}' of '${props.repository.displayName}'? This action cannot be undone.`
                  : `Delete entire vault for '${props.repository.displayName}'? This will remove all data across all branches.`}
              </p>
              <div class="modal-action">
                <button type="button" class="btn" onClick={() => setDeleteConfirm(null)} disabled={deleting()}>
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn-error"
                  disabled={deleting()}
                  onClick={async () => {
                    setDeleting(true)
                    try {
                      if (confirm().type === 'scope' && confirm().scope) {
                        await deleteScope(confirm().scope)
                      } else {
                        await deleteScope(confirm().scope!, true)
                      }
                      setDeleteConfirm(null)
                      // Refresh the entries list
                      await refreshEntries()
                    } catch (error) {
                      console.error('Failed to delete:', error)
                      alert(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`)
                    } finally {
                      setDeleting(false)
                    }
                  }}
                >
                  {deleting() ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
