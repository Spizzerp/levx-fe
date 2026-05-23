import { describe, expect, it } from 'vitest'
import { searchDocs } from '../search'

describe('searchDocs', () => {
  it('finds docs pages by title and tagline terms', () => {
    const results = searchDocs('getting devnet')

    expect(results[0]).toMatchObject({
      doc: 'getting-started',
      kind: 'Page',
      title: 'Getting Started',
    })
  })

  it('finds section-level matches with anchors', () => {
    const results = searchDocs('quantum cache')

    expect(results).toContainEqual(
      expect.objectContaining({
        doc: 'quantum-scoring-engine',
        anchor: 'quantum-cache',
        kind: 'Section',
      }),
    )
  })

  it('finds the external provider gateway docs section', () => {
    const results = searchDocs('provider gateway')

    expect(results).toContainEqual(
      expect.objectContaining({
        doc: 'ai-pipeline',
        anchor: 'external-provider-gateway',
        kind: 'Section',
      }),
    )
  })

  it('does not expose internal stability status as a searchable public term', () => {
    expect(searchDocs('stable')).toEqual([])
  })
})
