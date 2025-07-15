import { For, Show } from 'solid-js'
import { currentProject, loading, projects } from '../stores/vault'
import ProjectTree from './ProjectTree'

export default function Sidebar() {
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
        <p class="text-sm text-base-content/60 mt-1">Knowledge vault for AI development</p>
      </div>

      <Show
        when={loading()}
        fallback={
          <div class="px-2 pb-4">
            {/* Current Project Section */}
            <Show when={currentProject()}>
              <div>
                <div class="text-xs font-semibold text-base-content/60 uppercase tracking-wider px-3 py-2">
                  Current Project
                </div>
                <For each={projects() || []}>
                  {(project) => (
                    <Show when={project.project === currentProject()}>
                      <ProjectTree project={project} isCurrentProject={true} />
                    </Show>
                  )}
                </For>
              </div>
            </Show>

            {/* Other Projects Section */}
            <Show when={projects() && projects().filter((p) => p.project !== currentProject()).length > 0}>
              <div class="mt-4">
                <div class="text-xs font-semibold text-base-content/60 uppercase tracking-wider px-3 py-2">
                  Other Projects
                </div>
                <For each={projects() || []}>
                  {(project) => (
                    <Show when={project.project !== currentProject()}>
                      <ProjectTree project={project} isCurrentProject={false} />
                    </Show>
                  )}
                </For>
              </div>
            </Show>
          </div>
        }
      >
        <div class="flex justify-center items-center p-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      </Show>
    </div>
  )
}
