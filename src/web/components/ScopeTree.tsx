import { Check, ChevronRight, Folder, GitBranch, Globe } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { api } from '../lib/api'
import { collapsedRepos, setViewMode, toggleRepoCollapse } from '../stores/ui'
import type { RepositoryGroup } from '../stores/vault'
import { currentScope, setSelectedScope } from '../stores/vault'

interface ScopeTreeProps {
  repository: RepositoryGroup
}

export default function ScopeTree(props: ScopeTreeProps) {
  const isCollapsed = () => collapsedRepos().has(props.repository.identifier)
  const isGlobal = () => props.repository.identifier === 'global'

  function toggleCollapse() {
    if (!isGlobal()) {
      toggleRepoCollapse(props.repository.identifier)
    }
  }

  async function selectBranch(branch: string) {
    setSelectedScope({ identifier: props.repository.identifier, branch })
    setViewMode('table')

    // Load entries for this scope
    try {
      await api.getScopeEntries(props.repository.identifier, branch)
      // This will be handled by the parent component watching selectedScope
    } catch (error) {
      console.error('Failed to load scope entries:', error)
    }
  }

  function isCurrentBranch(branch: string): boolean {
    const current = currentScope()
    const scopeStr = props.repository.branches.find((b) => b.branch === branch)?.scope
    return current === scopeStr
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
            onClick={() => selectBranch('global')}
            class={`btn btn-ghost w-full justify-start normal-case h-auto min-h-[2.5rem] py-2 ${
              isCurrentBranch('global') ? 'btn-active' : ''
            }`}
          >
            <Globe class="w-5 h-5 mr-2 flex-shrink-0 text-base-content/60" />
            <span class="font-medium text-base text-base-content truncate">{props.repository.displayName}</span>
            <span class={`ml-auto badge ${isCurrentBranch('global') ? 'badge-primary' : ''}`}>
              {props.repository.branches[0]?.entries.length || 0}
            </span>
          </button>
        }
      >
        {/* Repository with branches */}
        <button type="button" onClick={toggleCollapse} class="btn btn-ghost w-full justify-start normal-case h-auto min-h-[2.5rem] py-2">
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
      </Show>

      {/* Branches */}
      <Show when={!isGlobal() && !isCollapsed()}>
        <div class="ml-6 mt-1">
          <For each={props.repository.branches}>
            {(branch) => (
              <button
                type="button"
                onClick={() => selectBranch(branch.branch)}
                class={`btn btn-ghost w-full justify-start normal-case h-auto min-h-[2.5rem] py-2 ${
                  isCurrentBranch(branch.branch) ? 'btn-active' : ''
                }`}
              >
                <GitBranch class="w-5 h-5 mr-2 flex-shrink-0 text-base-content/60" />
                <span class="font-medium text-base text-base-content truncate">{branch.branch}</span>
                <Show when={isCurrentBranch(branch.branch)}>
                  <Check class="w-4 h-4 ml-2 text-primary" />
                </Show>
                <span class={`ml-auto badge ${isCurrentBranch(branch.branch) ? 'badge-primary' : ''}`}>
                  {branch.entries.length}
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
