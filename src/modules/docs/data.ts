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
      { id: 'quantum-scoring-engine', label: 'Quantum Path Engine', status: 'stable' },
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
      'Where path-level prediction can create richer markets, benchmarks, and forecasting products.',
    meta: [
      { label: 'AUDIENCE', value: 'Traders, analysts, builders, AI providers' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'trading', num: '01', heading: 'Path-aware trading' },
      { id: 'prediction-portfolios', num: '02', heading: 'Prediction portfolios' },
      { id: 'ai-benchmarks', num: '03', heading: 'AI path benchmarks' },
      { id: 'research', num: '04', heading: 'Forecast research' },
      { id: 'risk', num: '05', heading: 'Risk expression' },
      { id: 'non-crypto', num: '06', heading: 'Beyond crypto' },
      { id: 'requirements', num: '07', heading: 'Requirements' },
    ],
  },
  'protocol-overview': {
    category: '02 - Protocol',
    title: 'Overview',
    tagline:
      'How the on-chain program, math engine, path-state model, oracle layer, AI service, and verification work fit together.',
    meta: [
      { label: 'PROGRAM', value: 'Anchor' },
      { label: 'ORACLE', value: 'Pyth' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'foundation', num: '01', heading: 'Foundation' },
      { id: 'onchain-engine', num: '02', heading: 'On-chain engine' },
      { id: 'math-engine', num: '03', heading: 'Math and pricing engine' },
      { id: 'service-layer', num: '04', heading: 'Service layer' },
      { id: 'verification', num: '05', heading: 'Verification and trust boundary' },
    ],
  },
  'quantum-scoring-engine': {
    category: '02 - Protocol',
    title: 'Quantum Path Engine',
    tagline:
      'How LevX combines path scoring, amplitudes, thin-liquidity LS-LMSR, and optional correlated-path pricing.',
    meta: [
      { label: 'TYPE', value: 'Quantum-inspired' },
      { label: 'FALLBACK', value: 'LS-LMSR' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'path-scoring', num: '01', heading: 'Path scoring' },
      { id: 'amplitudes', num: '02', heading: 'Amplitudes' },
      { id: 'pricing', num: '03', heading: 'Pricing' },
      { id: 'thin-liquidity', num: '04', heading: 'Thin-liquidity adaptations' },
      { id: 'quantum-cache', num: '05', heading: 'Quantum cache' },
      { id: 'not-quantum-computer', num: '06', heading: 'What it is not' },
    ],
  },
  'ai-pipeline': {
    category: '02 - Protocol',
    title: 'AI Pipeline',
    tagline:
      'How LevX uses internal foundation-model path generation today, and how external AI providers can compete in future markets.',
    meta: [
      { label: 'MODELS', value: 'TimesFM 2.5 + Chronos-2' },
      { label: 'HOSTING', value: 'RunPod Serverless' },
      { label: 'STATUS', value: 'Alpha' },
    ],
    sections: [
      { id: 'role', num: '01', heading: 'Role of AI' },
      { id: 'internal-providers', num: '02', heading: 'Internal providers' },
      { id: 'market-flow', num: '03', heading: 'Market generation flow' },
      { id: 'onchain-boundary', num: '04', heading: 'On-chain boundary' },
      { id: 'provider-roadmap', num: '05', heading: 'Provider roadmap' },
      { id: 'feedback-loop', num: '06', heading: 'Feedback loop' },
    ],
  },
  'core-architecture': {
    category: '02 - Protocol',
    title: 'Core Logic & Architecture',
    tagline:
      'How markets are created, priced, sampled, dissolved, scored, disputed, and claimed on-chain.',
    meta: [
      { label: 'MODE', value: 'Mode 1 beta' },
      { label: 'PATHS', value: '3-16' },
      { label: 'CHECKPOINTS', value: '4-120' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'account-model', num: '01', heading: 'Account model' },
      { id: 'market-setup', num: '02', heading: 'Market setup' },
      { id: 'lifecycle', num: '03', heading: 'Lifecycle and keepers' },
      { id: 'trading-pricing', num: '04', heading: 'Trading and pricing' },
      { id: 'checkpoints', num: '05', heading: 'Checkpoints and path evolution' },
      { id: 'settlement', num: '06', heading: 'Settlement, disputes, and claims' },
      { id: 'boundaries', num: '07', heading: 'Current boundaries' },
    ],
  },
  whitepaper: {
    category: '03 - Resources',
    title: 'Whitepaper',
    tagline:
      'A public draft of the LevX thesis, mechanism design, protocol architecture, and roadmap.',
    meta: [
      { label: 'VERSION', value: 'v0.1 public draft' },
      { label: 'SCOPE', value: 'Mode 1 beta' },
      { label: 'STATUS', value: 'Draft' },
    ],
    sections: [
      { id: 'abstract', num: '01', heading: 'Abstract' },
      { id: 'thesis', num: '02', heading: 'Thesis' },
      { id: 'market-model', num: '03', heading: 'Market model' },
      { id: 'protocol-architecture', num: '04', heading: 'Protocol architecture' },
      { id: 'pricing', num: '05', heading: 'Pricing' },
      { id: 'scoring', num: '06', heading: 'Scoring and settlement' },
      { id: 'ai-layer', num: '07', heading: 'AI path layer' },
      { id: 'trust-security', num: '08', heading: 'Trust and security' },
      { id: 'roadmap', num: '09', heading: 'Roadmap' },
    ],
  },
  roadmap: {
    category: '03 - Resources',
    title: 'Roadmap',
    tagline:
      'A staged path from Mode 1 path markets toward validated AI competition, deeper liquidity, and production readiness.',
    meta: [
      { label: 'CURRENT', value: 'Mode 1 beta' },
      { label: 'NEXT', value: 'Hardening + AI validation' },
      { label: 'FUTURE', value: 'Provider marketplace + Mode 2' },
      { label: 'STATUS', value: 'Draft' },
    ],
    sections: [
      { id: 'mode1-beta', num: '01', heading: 'Mode 1 beta' },
      { id: 'hardening', num: '02', heading: 'Production hardening' },
      { id: 'ai-validation', num: '03', heading: 'AI validation' },
      { id: 'provider-marketplace', num: '04', heading: 'Provider marketplace' },
      { id: 'liquidity', num: '05', heading: 'Liquidity expansion' },
      { id: 'mode2', num: '06', heading: 'Mode 2 leverage' },
      { id: 'mainnet-governance', num: '07', heading: 'Mainnet and governance' },
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
      { label: 'REPOSITORIES', value: 'Protocol, FE, Infra' },
      { label: 'STATUS', value: 'Stable' },
    ],
    sections: [
      { id: 'protocol-repo', num: '01', heading: 'Protocol repository' },
      { id: 'frontend-repo', num: '02', heading: 'Frontend repository' },
      { id: 'infra-repo', num: '03', heading: 'Infrastructure repository' },
    ],
  },
  community: {
    category: '04 - Links',
    title: 'Community',
    tagline: 'Official community links and announcements.',
    meta: [
      { label: 'STATUS', value: 'Live' },
      { label: 'CHANNELS', value: 'X' },
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
