export type DocId =
  | 'introduction'
  | 'quick-start'
  | 'concepts'
  | 'path-markets'
  | 'scoring-engine'
  | 'settlement'
  | 'vault'
  | 'cli'
  | 'sdk'
  | 'api'
  | 'whitepaper'
  | 'audit'
  | 'changelog'

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
