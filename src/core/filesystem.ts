import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { encodeProjectPath, OBJECTS_DIR } from './config.js'

export class VaultFileSystem {
  constructor() {
    // Ensure objects directory exists
    mkdirSync(OBJECTS_DIR, { recursive: true })
  }

  private getProjectDir(project: string): string {
    const encodedProject = encodeProjectPath(project)
    return join(OBJECTS_DIR, encodedProject)
  }

  private getFilePath(project: string, key: string, version: number): string {
    const projectDir = this.getProjectDir(project)
    return join(projectDir, `${key}_${version}.txt`)
  }

  saveFile(project: string, key: string, version: number, content: string): { path: string; hash: string } {
    const projectDir = this.getProjectDir(project)
    mkdirSync(projectDir, { recursive: true })

    const filePath = this.getFilePath(project, key, version)
    const hash = this.calculateHash(content)

    writeFileSync(filePath, content, 'utf-8')

    return { path: filePath, hash }
  }

  readFile(filePath: string): string {
    return readFileSync(filePath, 'utf-8')
  }

  deleteFile(filePath: string): void {
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }

  fileExists(filePath: string): boolean {
    return existsSync(filePath)
  }

  calculateHash(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex')
  }

  verifyFile(filePath: string, expectedHash: string): boolean {
    if (!this.fileExists(filePath)) {
      return false
    }

    const content = this.readFile(filePath)
    const actualHash = this.calculateHash(content)
    return actualHash === expectedHash
  }
}
