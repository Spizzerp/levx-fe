import type { DocId, DocMeta, SidebarSection } from './types'

export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    id: 'overview',
    num: '00',
    label: 'Overview',
    items: [
      { id: 'introduction', label: 'Introduction', status: 'stable' },
      { id: 'problem', label: 'Problem', status: 'stable' },
      { id: 'solution', label: 'Solution', status: 'stable' },
    ],
  },
  {
    id: 'guide',
    num: '01',
    label: 'Guide',
    items: [
      { id: 'getting-started', label: 'Getting Started', status: 'beta' },
      { id: 'use-cases', label: 'Use Cases', status: 'stable' },
    ],
  },
  {
    id: 'protocol',
    num: '02',
    label: 'Protocol',
    items: [
      { id: 'protocol-overview', label: 'Overview', status: 'stable' },
      { id: 'quantum-scoring-engine', label: 'Quantum Scoring Engine', status: 'stable' },
      { id: 'ai-pipeline', label: 'AI Pipeline', status: 'alpha' },
      { id: 'core-architecture', label: 'Core Logic & Architecture', status: 'stable' },
    ],
  },
  {
    id: 'resources',
    num: '03',
    label: 'Resources',
    items: [
      { id: 'whitepaper', label: 'Whitepaper', status: 'draft' },
      { id: 'roadmap', label: 'Roadmap', status: 'draft' },
      { id: 'security-audits', label: 'Security & Audits', status: 'beta' },
      { id: 'faq', label: 'FAQ', status: 'stable' },
      { id: 'risks', label: 'Risks', status: 'stable' },
    ],
  },
  {
    id: 'links',
    num: '04',
    label: 'Links',
    items: [
      { id: 'launch-app', label: 'Launch App', status: 'stable' },
      { id: 'github', label: 'GitHub', status: 'stable' },
      { id: 'community', label: 'Community', status: 'draft' },
    ],
  },
]

/** Flat ordered sequence used for prev/next pagination. */
export const DOC_ORDER: readonly DocId[] = SIDEBAR_SECTIONS.flatMap((s) => s.items.map((i) => i.id))

export const DOC_META: Record<DocId, DocMeta> = {
  introduction: {
    category: '00 - Overview',
    title: 'Introduction',
    tagline:
      'LevX is a Solana path-prediction protocol for trading the route an asset takes through time.',
    meta: [
      { label: 'NETWORK', value: 'Solana Devnet' },
      { label: 'VERSION', value: 'v0.1.0' },
      { label: 'UPDATED', value: '2026-04-28' },
      { label: 'STATUS', value: 'Public beta docs' },
    ],
    sections: [
      { id: 'what-is-levx', num: '01', heading: 'What is LevX?' },
      { id: 'how-it-works', num: '02', heading: 'How it works' },
      { id: 'why-it-matters', num: '03', heading: 'Why it matters' },
      { id: 'current-scope', num: '04', heading: 'Current scope' },
    ],
  },
  problem: {
    category: '00 - Overview',
    title: 'Problem',
    tagline:
      'Most market products compress rich price behavior into a single endpoint or binary result.',
    meta: [
      { label: 'FOCUS', value: 'Prediction markets' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'endpoint-loss', num: '01', heading: 'Endpoint loss' },
      { id: 'timing-risk', num: '02', heading: 'Timing and path risk' },
      { id: 'ai-gap', num: '03', heading: 'AI signal gap' },
      { id: 'settlement-gap', num: '04', heading: 'Settlement gap' },
    ],
  },
  solution: {
    category: '00 - Overview',
    title: 'Solution',
    tagline:
      'LevX turns paths into first-class market objects and scores them against oracle checkpoints.',
    meta: [
      { label: 'MODEL', value: 'Path markets' },
      { label: 'SETTLEMENT', value: 'Oracle checkpoint scoring' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'path-markets', num: '01', heading: 'Path markets' },
      { id: 'scoring', num: '02', heading: 'Richer scoring' },
      { id: 'market-design', num: '03', heading: 'Market design' },
      { id: 'mode2', num: '04', heading: 'Mode 2 roadmap' },
    ],
  },
  'getting-started': {
    category: '01 - Guide',
    title: 'Getting Started',
    tagline: 'How to explore LevX during the current devnet beta phase.',
    meta: [
      { label: 'INTERFACE', value: 'Web app' },
      { label: 'NETWORK', value: 'Devnet' },
      { label: 'STATUS', value: 'Beta' },
    ],
    sections: [
      { id: 'open-app', num: '01', heading: 'Open the app' },
      { id: 'browse-markets', num: '02', heading: 'Browse markets' },
      { id: 'read-paths', num: '03', heading: 'Read paths' },
      { id: 'connect-wallet', num: '04', heading: 'Connect a wallet' },
      { id: 'claim', num: '05', heading: 'Claim settled payouts' },
    ],
  },
  'use-cases': {
    category: '01 - Guide',
    title: 'Use Cases',
    tagline:
      'Where path-level prediction creates a better market than a yes/no or endpoint-only result.',
    meta: [
      { label: 'AUDIENCE', value: 'Traders, analysts, builders' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'trading', num: '01', heading: 'Path-aware trading' },
      { id: 'research', num: '02', heading: 'Forecast research' },
      { id: 'ai-benchmarks', num: '03', heading: 'AI path benchmarks' },
      { id: 'risk', num: '04', heading: 'Risk expression' },
    ],
  },
  'protocol-overview': {
    category: '02 - Protocol',
    title: 'Overview',
    tagline:
      'A high-level view of the on-chain market engine, keeper layer, AI path service, and frontend.',
    meta: [
      { label: 'PROGRAM', value: 'Anchor' },
      { label: 'ORACLE', value: 'Pyth' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'system', num: '01', heading: 'System components' },
      { id: 'accounts', num: '02', heading: 'Core accounts' },
      { id: 'lifecycle', num: '03', heading: 'Lifecycle' },
      { id: 'trust-boundary', num: '04', heading: 'Trust boundary' },
    ],
  },
  'quantum-scoring-engine': {
    category: '02 - Protocol',
    title: 'Quantum Scoring Engine',
    tagline:
      'How LevX combines path scoring, amplitudes, LS-LMSR pricing, and optional correlated-path pricing.',
    meta: [
      { label: 'TYPE', value: 'Quantum-inspired' },
      { label: 'FALLBACK', value: 'LS-LMSR' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'path-scoring', num: '01', heading: 'Path scoring' },
      { id: 'amplitudes', num: '02', heading: 'Amplitudes' },
      { id: 'pricing', num: '03', heading: 'Pricing' },
      { id: 'quantum-cache', num: '04', heading: 'Quantum cache' },
      { id: 'not-quantum-computer', num: '05', heading: 'What it is not' },
    ],
  },
  'ai-pipeline': {
    category: '02 - Protocol',
    title: 'AI Pipeline',
    tagline:
      'AI proposes candidate paths, while the protocol settles outcomes deterministically on-chain.',
    meta: [
      { label: 'ROLE', value: 'Path generation' },
      { label: 'BOUNDARY', value: 'Off-chain service' },
      { label: 'STATUS', value: 'Alpha' },
    ],
    sections: [
      { id: 'role', num: '01', heading: 'Role of AI' },
      { id: 'generation', num: '02', heading: 'Path generation' },
      { id: 'onchain-boundary', num: '03', heading: 'On-chain boundary' },
      { id: 'feedback-loop', num: '04', heading: 'Feedback loop' },
    ],
  },
  'core-architecture': {
    category: '02 - Protocol',
    title: 'Core Logic & Architecture',
    tagline:
      'The core logic that makes LevX deterministic: accounts, state transitions, keepers, oracles, and claims.',
    meta: [
      { label: 'MAX PATHS', value: '16' },
      { label: 'STATE MACHINE', value: '7 states' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'account-model', num: '01', heading: 'Account model' },
      { id: 'state-machine', num: '02', heading: 'State machine' },
      { id: 'keepers', num: '03', heading: 'Keepers and oracles' },
      { id: 'settlement', num: '04', heading: 'Settlement and disputes' },
    ],
  },
  whitepaper: {
    category: '03 - Resources',
    title: 'Whitepaper',
    tagline: 'A long-form technical paper covering the LevX market design and roadmap.',
    meta: [
      { label: 'STATUS', value: 'Drafting' },
      { label: 'FORMAT', value: 'Technical paper' },
    ],
    sections: [
      { id: 'scope', num: '01', heading: 'Scope' },
      { id: 'contents', num: '02', heading: 'Planned contents' },
      { id: 'availability', num: '03', heading: 'Availability' },
    ],
  },
  roadmap: {
    category: '03 - Resources',
    title: 'Roadmap',
    tagline:
      'A staged path from devnet Mode 1 markets toward deeper liquidity, leverage, and production readiness.',
    meta: [
      { label: 'CURRENT', value: 'Mode 1 beta' },
      { label: 'NEXT', value: 'Hardening and docs' },
      { label: 'STATUS', value: 'Draft' },
    ],
    sections: [
      { id: 'mode1', num: '01', heading: 'Mode 1' },
      { id: 'hardening', num: '02', heading: 'Hardening' },
      { id: 'mode2', num: '03', heading: 'Mode 2 liquidity' },
      { id: 'mainnet', num: '04', heading: 'Mainnet readiness' },
    ],
  },
  'security-audits': {
    category: '03 - Resources',
    title: 'Security & Audits',
    tagline: 'Security posture, completed remediation work, current guardrails, and audit status.',
    meta: [
      { label: 'SCOPE', value: 'Protocol, keeper, frontend' },
      { label: 'EXTERNAL AUDIT', value: 'Not yet completed' },
      { label: 'STATUS', value: 'Beta' },
    ],
    sections: [
      { id: 'guardrails', num: '01', heading: 'Protocol guardrails' },
      { id: 'testing', num: '02', heading: 'Testing' },
      { id: 'audits', num: '03', heading: 'Audit status' },
      { id: 'disclosures', num: '04', heading: 'Disclosures' },
    ],
  },
  faq: {
    category: '03 - Resources',
    title: 'FAQ',
    tagline: 'Short answers to common LevX protocol and product questions.',
    meta: [
      { label: 'STATUS', value: 'Stable' },
      { label: 'UPDATED', value: '2026-04-28' },
    ],
    sections: [
      { id: 'what-is-path', num: '01', heading: 'What is a path?' },
      { id: 'is-ai-trusted', num: '02', heading: 'Is the AI trusted?' },
      { id: 'is-quantum', num: '03', heading: 'Is this a quantum computer?' },
      { id: 'is-leverage-live', num: '04', heading: 'Is leverage live?' },
      { id: 'mainnet', num: '05', heading: 'Is LevX on mainnet?' },
    ],
  },
  risks: {
    category: '03 - Resources',
    title: 'Risks',
    tagline:
      'Important protocol, oracle, liquidity, operational, and product-stage risks to understand.',
    meta: [
      { label: 'TYPE', value: 'Risk disclosure' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'market-risk', num: '01', heading: 'Market risk' },
      { id: 'oracle-risk', num: '02', heading: 'Oracle risk' },
      { id: 'smart-contract-risk', num: '03', heading: 'Smart contract risk' },
      { id: 'liquidity-risk', num: '04', heading: 'Liquidity risk' },
      { id: 'stage-risk', num: '05', heading: 'Beta-stage risk' },
    ],
  },
  'launch-app': {
    category: '04 - Links',
    title: 'Launch App',
    tagline: 'Open the LevX web application and explore active devnet markets.',
    meta: [
      { label: 'DESTINATION', value: 'Web app' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'app', num: '01', heading: 'App' },
      { id: 'markets', num: '02', heading: 'Markets' },
    ],
  },
  github: {
    category: '04 - Links',
    title: 'GitHub',
    tagline: 'Explore the LevX protocol codebase and public development history.',
    meta: [
      { label: 'REPOSITORY', value: 'Spizzerp/LevXv2' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'protocol-repo', num: '01', heading: 'Protocol repository' },
      { id: 'frontend-repo', num: '02', heading: 'Frontend repository' },
    ],
  },
  community: {
    category: '04 - Links',
    title: 'Community',
    tagline: 'Official community links and announcements.',
    meta: [
      { label: 'STATUS', value: 'Coming soon' },
      { label: 'CHANNELS', value: 'To be announced' },
    ],
    sections: [
      { id: 'official-links', num: '01', heading: 'Official links' },
      { id: 'updates', num: '02', heading: 'Updates' },
    ],
  },
}

export function isDocId(value: string | undefined): value is DocId {
  return typeof value === 'string' && value in DOC_META
}
