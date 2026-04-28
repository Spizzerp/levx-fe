import type { DocId, DocMeta, SidebarSection } from './types'

export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    id: 'getting-started',
    num: '00',
    label: 'Getting Started',
    items: [
      { id: 'introduction', label: 'Introduction', status: 'stable' },
      { id: 'quick-start', label: 'Quick Start', status: 'stable' },
      { id: 'concepts', label: 'Core Concepts', status: 'stable' },
    ],
  },
  {
    id: 'protocol',
    num: '01',
    label: 'Protocol',
    items: [
      { id: 'path-markets', label: 'Path Markets', status: 'stable' },
      { id: 'scoring-engine', label: 'Scoring Engine', status: 'stable' },
      { id: 'settlement', label: 'Settlement', status: 'beta' },
      { id: 'vault', label: 'Vault', status: 'alpha' },
    ],
  },
  {
    id: 'reference',
    num: '02',
    label: 'Reference',
    items: [
      { id: 'cli', label: 'CLI', status: 'beta' },
      { id: 'sdk', label: 'SDK', status: 'beta' },
      { id: 'api', label: 'HTTP API', status: 'alpha' },
    ],
  },
  {
    id: 'resources',
    num: '03',
    label: 'Resources',
    items: [
      { id: 'whitepaper', label: 'Whitepaper', status: 'draft' },
      { id: 'audit', label: 'Audit Trail', status: 'draft' },
      { id: 'changelog', label: 'Changelog', status: 'stable' },
    ],
  },
]

/** Flat ordered sequence used for prev/next pagination. */
export const DOC_ORDER: readonly DocId[] = SIDEBAR_SECTIONS.flatMap((s) =>
  s.items.map((i) => i.id),
)

export const DOC_META: Record<DocId, DocMeta> = {
  introduction: {
    category: '00 — Getting Started',
    title: 'Introduction',
    tagline:
      'A path-prediction market protocol. Predict the route, not just the destination.',
    meta: [
      { label: 'VERSION', value: 'v0.1.0' },
      { label: 'NETWORK', value: 'Solana · Devnet' },
      { label: 'UPDATED', value: '2026-04-28' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'what-is-levx', num: '01', heading: 'What is LevX?' },
      { id: 'why-paths', num: '02', heading: 'Why paths instead of prices?' },
      { id: 'how-it-works', num: '03', heading: 'How it works' },
      { id: 'what-you-can-do', num: '04', heading: 'What you can do today' },
      { id: 'further-reading', num: '05', heading: 'Further reading' },
    ],
  },
  'quick-start': {
    category: '00 — Getting Started',
    title: 'Quick Start',
    tagline: 'Five steps from zero to your first wager on a live LevX market.',
    meta: [
      { label: 'VERSION', value: 'v0.1.0' },
      { label: 'EST. TIME', value: '8 min' },
      { label: 'PREREQUISITES', value: 'Solana wallet · USDC' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'install', num: '01', heading: 'Install the CLI' },
      { id: 'connect', num: '02', heading: 'Connect a wallet' },
      { id: 'fund', num: '03', heading: 'Fund the devnet account' },
      { id: 'discover', num: '04', heading: 'Discover a market' },
      { id: 'wager', num: '05', heading: 'Place your first wager' },
    ],
  },
  concepts: {
    category: '00 — Getting Started',
    title: 'Core Concepts',
    tagline:
      'The vocabulary you need to read the rest of these docs without backtracking.',
    meta: [
      { label: 'VERSION', value: 'v0.1.0' },
      { label: 'READING', value: '6 min' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'lexicon', num: '01', heading: 'Lexicon' },
      { id: 'lifecycle', num: '02', heading: 'Market lifecycle' },
      { id: 'roles', num: '03', heading: 'Roles in the system' },
    ],
  },
  'path-markets': {
    category: '01 — Protocol',
    title: 'Path Markets',
    tagline:
      'A market is a set of competing routes through time. Each route is a first-class on-chain object.',
    meta: [
      { label: 'VERSION', value: 'v0.1.0' },
      { label: 'PROGRAM', value: 'levx_protocol' },
      { label: 'ACCOUNT', value: 'PathMarket' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'shape', num: '01', heading: 'The shape of a market' },
      { id: 'paths', num: '02', heading: 'Paths' },
      { id: 'checkpoints', num: '03', heading: 'Checkpoints' },
      { id: 'amplitudes', num: '04', heading: 'Path amplitudes' },
    ],
  },
  'scoring-engine': {
    category: '01 — Protocol',
    title: 'Scoring Engine',
    tagline: 'How LevX turns a continuous price feed into a payout schedule.',
    meta: [
      { label: 'VERSION', value: 'v0.1.0' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'inputs', num: '01', heading: 'Inputs' },
      { id: 'formula', num: '02', heading: 'Scoring formula' },
      { id: 'decay', num: '03', heading: 'Decoherence and decay' },
    ],
  },
  settlement: {
    category: '01 — Protocol',
    title: 'Settlement',
    tagline: 'From the last checkpoint to a claimable payout.',
    meta: [
      { label: 'VERSION', value: 'v0.1.0' },
      { label: 'STATUS', value: 'Beta' },
    ],
    sections: [
      { id: 'finalize', num: '01', heading: 'Finalize' },
      { id: 'dispute', num: '02', heading: 'Dispute window' },
      { id: 'claim', num: '03', heading: 'Claim' },
    ],
  },
  vault: {
    category: '01 — Protocol',
    title: 'Vault',
    tagline:
      'Passive liquidity for the LS-LMSR market maker. Earn from spread, take inventory risk.',
    meta: [
      { label: 'VERSION', value: 'v0.0.4' },
      { label: 'STATUS', value: 'Alpha' },
    ],
    sections: [{ id: 'overview', num: '01', heading: 'Overview' }],
  },
  cli: {
    category: '02 — Reference',
    title: 'levx',
    tagline:
      'Command-line interface for inspecting markets, drawing paths, and submitting wagers.',
    meta: [
      { label: 'NAME', value: 'levx' },
      { label: 'SECTION', value: '1' },
      { label: 'VERSION', value: 'v0.1.0' },
      { label: 'STATUS', value: 'Beta' },
    ],
    sections: [
      { id: 'name', num: '01', heading: 'Name' },
      { id: 'synopsis', num: '02', heading: 'Synopsis' },
      { id: 'description', num: '03', heading: 'Description' },
      { id: 'options', num: '04', heading: 'Options' },
      { id: 'examples', num: '05', heading: 'Examples' },
      { id: 'see-also', num: '06', heading: 'See also' },
    ],
  },
  sdk: {
    category: '02 — Reference',
    title: 'SDK',
    tagline: 'TypeScript bindings for the LevX protocol.',
    meta: [
      { label: 'PACKAGE', value: '@levx/sdk' },
      { label: 'VERSION', value: 'v0.1.0' },
      { label: 'STATUS', value: 'Beta' },
    ],
    sections: [{ id: 'overview', num: '01', heading: 'Overview' }],
  },
  api: {
    category: '02 — Reference',
    title: 'HTTP API',
    tagline: 'Read-only endpoints for indexed market data.',
    meta: [
      { label: 'VERSION', value: 'v0.0.7' },
      { label: 'STATUS', value: 'Alpha' },
    ],
    sections: [{ id: 'overview', num: '01', heading: 'Overview' }],
  },
  whitepaper: {
    category: '03 — Resources',
    title: 'Whitepaper',
    tagline: 'The long-form spec. Currently being typeset.',
    meta: [
      { label: 'STATUS', value: 'Drafting' },
      { label: 'TARGET', value: 'Q3 2026' },
    ],
    sections: [{ id: 'overview', num: '01', heading: 'Overview' }],
  },
  audit: {
    category: '03 — Resources',
    title: 'Audit Trail',
    tagline: 'Public record of program audits, scope, and remediations.',
    meta: [
      { label: 'STATUS', value: 'Drafting' },
      { label: 'NEXT', value: 'Mainnet candidate' },
    ],
    sections: [{ id: 'overview', num: '01', heading: 'Overview' }],
  },
  changelog: {
    category: '03 — Resources',
    title: 'Changelog',
    tagline: 'A reverse-chronological log of protocol and CLI releases.',
    meta: [
      { label: 'LATEST', value: 'v0.1.0' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [{ id: 'releases', num: '01', heading: 'Releases' }],
  },
}
