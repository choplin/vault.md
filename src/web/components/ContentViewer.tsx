import { createEffect, Show } from 'solid-js'
import { api } from '../lib/api'
import {
  contentLoading,
  entryContent,
  error,
  selectedEntry,
  setContentLoading,
  setEntryContent,
  setError,
} from '../stores/vault'
import './github-markdown.css'

export default function ContentViewer() {
  let contentElement: HTMLElement

  createEffect(() => {
    const selected = selectedEntry()
    if (selected) {
      loadContent()
    }
  })

  async function loadContent() {
    const selected = selectedEntry()
    if (!selected) return

    setContentLoading(true)
    setError(null)

    try {
      const content = await api.getEntry(selected.scope, selected.key, selected.version)
      setEntryContent(content)

      // 次のティックでレンダリング
      setTimeout(renderMarkdown, 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load content')
    } finally {
      setContentLoading(false)
    }
  }

  async function renderMarkdown() {
    if (!contentElement || !entryContent()) return

    // 動的インポート
    const [{ marked }, Prism] = await Promise.all([import('marked'), import('prismjs')])

    // GitHub風の設定
    marked.setOptions({
      gfm: true,
      breaks: true,
    })

    // Prism言語の動的インポート
    await Promise.all([
      import('prismjs/components/prism-typescript'),
      import('prismjs/components/prism-javascript'),
      import('prismjs/components/prism-json'),
      import('prismjs/components/prism-bash'),
      import('prismjs/components/prism-python'),
      import('prismjs/themes/prism.css'), // GitHub風のライトテーマ
    ])

    const html = await marked.parse(entryContent())
    contentElement.innerHTML = html

    // シンタックスハイライト適用
    contentElement.querySelectorAll('pre code').forEach((block) => {
      Prism.highlightElement(block as HTMLElement)
    })
  }

  function handleEdit() {
    const selected = selectedEntry()
    if (selected) {
      const editUrl = selected.version
        ? `vault://edit/${selected.scope}/${selected.key}/${selected.version}`
        : `vault://edit/${selected.scope}/${selected.key}`
      window.location.href = editUrl
    }
  }

  return (
    <div class="flex-1 flex flex-col">
      {/* Content Header */}
      <Show when={selectedEntry()}>
        <div class="bg-base-100 border-b border-base-200 px-8 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-semibold text-base-content">{selectedEntry()!.key}</h2>
              <p class="text-sm text-base-content/60 mt-1">
                {selectedEntry()!.scope} • Version {selectedEntry()!.version || 'latest'}
              </p>
            </div>
            <div class="flex gap-2">
              <button type="button" class="btn btn-sm btn-ghost flex items-center gap-2" onClick={handleEdit}>
                <svg aria-hidden="true" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  ></path>
                </svg>
                Edit
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Content Area */}
      <div class="flex-1 overflow-y-auto content-area">
        <div class="max-w-5xl mx-auto px-8 py-6">
          {/* Error State */}
          <Show when={error()}>
            <div class="alert alert-error mb-4">
              <span>{error()}</span>
            </div>
          </Show>

          {/* Content */}
          <Show when={!contentLoading() && entryContent()}>
            <div class="bg-base-100 rounded-lg shadow-sm">
              <div class="px-8 py-6">
                <article ref={contentElement!} class="markdown-body"></article>
              </div>
            </div>
          </Show>

          {/* Loading Content */}
          <Show when={contentLoading()}>
            <div class="flex items-center justify-center py-12">
              <div class="text-center">
                <span class="loading loading-spinner loading-lg text-primary"></span>
                <p class="text-base-content/60 mt-4">Loading content...</p>
              </div>
            </div>
          </Show>

          {/* Empty State */}
          <Show when={!contentLoading() && !entryContent() && !error() && !selectedEntry()}>
            <div class="hero min-h-[50vh]">
              <div class="hero-content text-center">
                <div>
                  <svg
                    aria-hidden="true"
                    class="w-16 h-16 mx-auto mb-4 opacity-20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    ></path>
                  </svg>
                  <h1 class="text-2xl font-bold">No entry selected</h1>
                  <p class="py-6">Select an entry from the sidebar to view its content.</p>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
