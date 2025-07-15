import { createSignal, For, Show } from 'solid-js'
import type { ProjectGroup, VaultEntry } from '../lib/api'
import { selectedEntry, setSelectedEntry } from '../stores/vault'

interface ProjectTreeProps {
  project: ProjectGroup
  isCurrentProject: boolean
}

export default function ProjectTree(props: ProjectTreeProps) {
  const [open, setOpen] = createSignal(true)

  function selectEntry(entry: VaultEntry) {
    setSelectedEntry({
      project: entry.project,
      key: entry.key,
    })
  }

  function isSelected(entry: VaultEntry): boolean {
    const selected = selectedEntry()
    return selected !== null && selected.project === entry.project && selected.key === entry.key && !selected.version
  }

  return (
    <div class="mb-2">
      <button
        type="button"
        onClick={() => setOpen(!open())}
        class="btn btn-ghost btn-sm w-full justify-start normal-case"
      >
        <svg
          aria-hidden="true"
          class={`w-4 h-4 mr-2 flex-shrink-0 transition-transform text-base-content/40 ${open() ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
        <svg
          aria-hidden="true"
          class={`w-4 h-4 mr-2 flex-shrink-0 ${props.isCurrentProject ? 'text-primary' : 'text-base-content/60'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          ></path>
        </svg>
        <span class="font-medium text-base-content truncate">{props.project.project.split('/').pop()}</span>
        <span class={`ml-auto badge badge-sm ${props.isCurrentProject ? 'badge-primary' : ''}`}>
          {props.project.entries.length}
        </span>
      </button>

      <Show when={open()}>
        <div class="ml-5 mt-1">
          <For each={props.project.entries}>
            {(entry) => (
              <div class="w-full">
                <button
                  type="button"
                  onClick={() => selectEntry(entry)}
                  class={`btn btn-ghost btn-sm w-full justify-start ml-4 normal-case ${isSelected(entry) ? 'btn-active' : ''}`}
                >
                  <svg
                    aria-hidden="true"
                    class={`w-4 h-4 mr-2 flex-shrink-0 ${isSelected(entry) ? 'text-primary' : 'text-base-content/40'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    ></path>
                  </svg>
                  <div class="flex-1 text-left min-w-0">
                    <span class="text-base-content font-medium">{entry.key}</span>
                    <Show when={entry.description}>
                      <p class="text-xs text-base-content/60 truncate">{entry.description}</p>
                    </Show>
                  </div>
                  <span class="ml-2 text-xs opacity-60 flex-shrink-0">v{entry.versions?.[0]?.version || 1}</span>
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
