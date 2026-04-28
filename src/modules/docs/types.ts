export type DocId =
  | 'introduction'
  | 'problem'
  | 'solution'
  | 'getting-started'
  | 'use-cases'
  | 'protocol-overview'
  | 'quantum-scoring-engine'
  | 'ai-pipeline'
  | 'core-architecture'
  | 'whitepaper'
  | 'roadmap'
  | 'security-audits'
  | 'faq'
  | 'risks'
  | 'launch-app'
  | 'github'
  | 'community'

export type Status = 'stable' | 'beta' | 'alpha' | 'draft'

export interface SidebarItem {
  id: DocId
  label: string
  status: Status
}

export interface SidebarSection {
  id: string
  num: string
  label: string
  items: SidebarItem[]
}

export interface DocSectionMeta {
  id: string
  num: string
  heading: string
}

export interface DocMeta {
  category: string
  title: string
  tagline: string
  meta: { label: string; value: string }[]
  sections: DocSectionMeta[]
}
