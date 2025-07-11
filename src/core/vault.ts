import { readFileSync } from 'node:fs'
import { VaultDatabase } from './database.js'
import { VaultFileSystem } from './filesystem.js'
import type { ListOptions, SetOptions, VaultEntry, VaultOptions } from './types.js'

export class VaultCore {
  private db: VaultDatabase
  private fs: VaultFileSystem
  private currentProject: string

  constructor(project?: string) {
    this.db = new VaultDatabase()
    this.fs = new VaultFileSystem()
    this.currentProject = project || process.cwd()
  }

  set(key: string, filePath: string, options: SetOptions = {}): string {
    // Read content from file or stdin
    const content = filePath === '-' ? readFileSync(0, 'utf-8') : this.fs.readFile(filePath)

    // Get next version
    const version = this.db.getNextVersion(this.currentProject, key)

    // Save file
    const { path, hash } = this.fs.saveFile(this.currentProject, key, version, content)

    // Save to database
    this.db.insertEntry({
      project: this.currentProject,
      version,
      key,
      filePath: path,
      hash,
      description: options.description,
    })

    return path
  }

  get(key: string, options: VaultOptions = {}): string | undefined {
    const project = options.project || this.currentProject

    const entry = options.version
      ? this.db.getEntry(project, key, options.version)
      : this.db.getLatestEntry(project, key)

    if (!entry) {
      return undefined
    }

    // Verify file integrity
    if (!this.fs.verifyFile(entry.filePath, entry.hash)) {
      throw new Error(`File integrity check failed for ${key}`)
    }

    return entry.filePath
  }

  cat(key: string, options: VaultOptions = {}): string | undefined {
    const filePath = this.get(key, options)

    if (!filePath) {
      return undefined
    }

    return this.fs.readFile(filePath)
  }

  list(options: ListOptions = {}): VaultEntry[] {
    const project = options.project || this.currentProject
    return this.db.listEntries(project, options.allVersions)
  }

  delete(key: string, options: VaultOptions = {}): boolean {
    const project = options.project || this.currentProject

    // Get entries to delete
    const entries = options.version
      ? [this.db.getEntry(project, key, options.version)].filter(Boolean)
      : this.db.listEntries(project, true).filter((e) => e.key === key)

    if (entries.length === 0) {
      return false
    }

    // Delete files
    entries.forEach((entry) => {
      if (entry) {
        this.fs.deleteFile(entry.filePath)
      }
    })

    // Delete from database
    return this.db.deleteEntry(project, key, options.version)
  }

  info(key: string, options: VaultOptions = {}): VaultEntry | undefined {
    const project = options.project || this.currentProject

    return options.version ? this.db.getEntry(project, key, options.version) : this.db.getLatestEntry(project, key)
  }

  close(): void {
    this.db.close()
  }
}
