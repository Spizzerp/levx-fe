import { DOC_META, DOC_ORDER, SIDEBAR_SECTIONS } from './data'
import type { DocId } from './types'

type SearchKind = 'Page' | 'Section'

export interface DocsSearchResult {
  id: string
  doc: DocId
  anchor?: string
  title: string
  subtitle: string
  excerpt: string
  kind: SearchKind
}

interface SearchEntry extends DocsSearchResult {
  haystack: string
  order: number
}

const docGroups = new Map<DocId, string>()

SIDEBAR_SECTIONS.forEach((section) => {
  section.items.forEach((item) => {
    docGroups.set(item.id, section.label)
  })
})

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const SEARCH_INDEX: SearchEntry[] = DOC_ORDER.flatMap((doc, docIndex) => {
  const meta = DOC_META[doc]
  const group = docGroups.get(doc) ?? meta.category
  const metaValues = meta.meta
    .filter((item) => item.label !== 'STATUS')
    .map((item) => `${item.label} ${item.value}`)
    .join(' ')
  const sectionHeadings = meta.sections.map((section) => section.heading).join(' ')

  const pageEntry: SearchEntry = {
    id: `${doc}:page`,
    doc,
    title: meta.title,
    subtitle: `${group} / ${meta.category}`,
    excerpt: meta.tagline,
    kind: 'Page',
    order: docIndex * 100,
    haystack: normalize(
      `${meta.title} ${meta.category} ${group} ${meta.tagline} ${metaValues} ${sectionHeadings}`,
    ),
  }

  const sectionEntries: SearchEntry[] = meta.sections.map((section, sectionIndex) => ({
    id: `${doc}:${section.id}`,
    doc,
    anchor: section.id,
    title: section.heading,
    subtitle: `${meta.title} / ${group}`,
    excerpt: meta.tagline,
    kind: 'Section',
    order: docIndex * 100 + sectionIndex + 1,
    haystack: normalize(
      `${section.heading} ${section.id} ${meta.title} ${meta.category} ${group} ${meta.tagline}`,
    ),
  }))

  return [pageEntry, ...sectionEntries]
})

function scoreEntry(entry: SearchEntry, terms: string[]) {
  let score = 0
  const normalizedTitle = normalize(entry.title)

  for (const term of terms) {
    if (!entry.haystack.includes(term)) return 0
    score += 1
    if (normalizedTitle === term) score += 12
    else if (normalizedTitle.startsWith(term)) score += 8
    else if (normalizedTitle.includes(term)) score += 4
    if (entry.kind === 'Page') score += 1
  }

  return score
}

export function searchDocs(query: string, limit = 8): DocsSearchResult[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean)

  if (terms.length === 0) return []

  return SEARCH_INDEX.map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.order - b.entry.order)
    .slice(0, limit)
    .map(({ entry }) => ({
      id: entry.id,
      doc: entry.doc,
      anchor: entry.anchor,
      title: entry.title,
      subtitle: entry.subtitle,
      excerpt: entry.excerpt,
      kind: entry.kind,
    }))
}
