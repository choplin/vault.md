import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { encodeProjectPath, getObjectsDir } from './config.js'

// Initialize objects directory lazily
let initialized = false
function ensureObjectsDir(): void {
  if (!initialized) {
    mkdirSync(getObjectsDir(), { recursive: true })
    initialized = true
  }
}

export function getProjectDir(project: string): string {
  const encodedProject = encodeProjectPath(project)
  return join(getObjectsDir(), encodedProject)
}

function getFilePath(project: string, key: string, version: number): string {
  const projectDir = getProjectDir(project)
  const encodedKey = encodeURIComponent(key)
  return join(projectDir, `${encodedKey}_v${version}.txt`)
}

export function saveFile(
  project: string,
  key: string,
  version: number,
  content: string,
): { path: string; hash: string } {
  ensureObjectsDir()
  const projectDir = getProjectDir(project)
  mkdirSync(projectDir, { recursive: true })

  const filePath = getFilePath(project, key, version)
  const hash = calculateHash(content)

  writeFileSync(filePath, content, 'utf-8')

  return { path: filePath, hash }
}

export function readFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

export function deleteFile(filePath: string): void {
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}

export function fileExists(filePath: string): boolean {
  return existsSync(filePath)
}

export function calculateHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex')
}

export function verifyFile(filePath: string, expectedHash: string): boolean {
  if (!fileExists(filePath)) {
    return false
  }

  const content = readFile(filePath)
  const actualHash = calculateHash(content)
  return actualHash === expectedHash
}

// Delete all files for a project (scope)
export function deleteProjectFiles(project: string): void {
  const projectDir = getProjectDir(project)
  if (existsSync(projectDir)) {
    rmSync(projectDir, { recursive: true, force: true })
  }
}

// Delete all files matching a key pattern
export function deleteKeyFiles(project: string, key: string): number {
  const projectDir = getProjectDir(project)
  if (!existsSync(projectDir)) {
    return 0
  }

  const encodedKey = encodeURIComponent(key)
  const files = readdirSync(projectDir)
  let deletedCount = 0

  for (const file of files) {
    // Match files like "encodedKey_v1.txt", "encodedKey_v2.txt", etc.
    if (file.startsWith(`${encodedKey}_v`) && file.endsWith('.txt')) {
      const filePath = join(projectDir, file)
      deleteFile(filePath)
      deletedCount++
    }
  }

  return deletedCount
}
