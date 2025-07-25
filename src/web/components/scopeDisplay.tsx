import type { Scope } from '../../core/scope'

export function formatScopeForListDisplay(scope: Scope): string {
  switch (scope.type) {
    case 'global':
      return 'global'
    case 'repository': {
      const parts = scope.identifier.split('/')
      return parts[parts.length - 1] || scope.identifier
    }
    case 'branch': {
      const parts = scope.identifier.split('/')
      const repoName = parts[parts.length - 1] || scope.identifier
      return `${repoName}:${scope.branch}`
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
