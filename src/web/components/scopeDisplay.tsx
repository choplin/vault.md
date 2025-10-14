import type { Scope } from '../../core/scope'

export function formatScopeForListDisplay(scope: Scope): string {
  switch (scope.type) {
    case 'global':
      return 'global'
    case 'repository': {
      const parts = scope.primaryPath.split('/')
      return parts[parts.length - 1] || scope.primaryPath
    }
    case 'branch': {
      const parts = scope.primaryPath.split('/')
      const repoName = parts[parts.length - 1] || scope.primaryPath
      return `${repoName}:${scope.branchName}`
    }
  }
}

export function getScopeDisplayClass(scope: Scope): string {
  switch (scope.type) {
    case 'global':
      return 'badge-primary'
    case 'repository':
      return 'badge-secondary'
    case 'branch':
      return 'badge-accent'
  }
}
