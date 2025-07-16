import { onMount } from 'solid-js'
import ContentViewer from './components/ContentViewer'
import Sidebar from './components/Sidebar'
import { api } from './lib/api'
import { setCurrentScope, setError, setLoading, setScopes } from './stores/vault'

export default function App() {
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

  return (
    <div class="flex h-screen">
      <Sidebar />
      <ContentViewer />
    </div>
  )
}
