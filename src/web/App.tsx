import { onMount } from 'solid-js'
import ContentViewer from './components/ContentViewer'
import Sidebar from './components/Sidebar'
import { api } from './lib/api'
import { setCurrentProject, setError, setLoading, setProjects } from './stores/vault'

export default function App() {
  onMount(async () => {
    try {
      const currentProj = await api.getCurrentProject()
      setCurrentProject(currentProj)

      const data = await api.getAllEntries()
      setProjects(data.projects || [])
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
