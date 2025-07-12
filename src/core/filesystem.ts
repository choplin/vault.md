import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
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

function getProjectDir(project: string): string {
  const encodedProject = encodeProjectPath(project)
  return join(getObjectsDir(), encodedProject)
}

function getFilePath(project: string, key: string, version: number): string {
  const projectDir = getProjectDir(project)
  return join(projectDir, `${key}_${version}.txt`)
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
