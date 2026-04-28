/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Code, CodeBlock, Li, Note, P, Section, Ul } from './primitives'
import type { DocId } from './types'

function IntroductionContent() {
  return (
    <>
      <Section id="what-is-levx" num="01" heading="What is LevX?">
        <P>
          LevX is a path-prediction market protocol on Solana. Instead of trading only whether an
          asset finishes above or below a target, LevX lets users express a view on the route an
          asset takes through time.
        </P>
        <P>
          Each market contains competing predicted paths. The protocol compares those paths against
          verified price checkpoints, scores how closely each path tracked reality, and distributes
          the market pool through deterministic on-chain settlement.
        </P>
      </Section>

      <Section id="how-it-works" num="02" heading="How it works">
        <CodeBlock language="flow">{`1. A market is created for a pair and time window.
2. AI and user-created paths are submitted before activation.
3. Users back paths with collateral.
4. Pyth-backed checkpoints record market reality.
5. LevX scores each path across the full route.
6. Settled markets allow users to claim payouts on-chain.`}</CodeBlock>
      </Section>

      <Section id="why-it-matters" num="03" heading="Why it matters">
        <P>
          Markets are not only about endpoints. Timing, drawdown, volatility, trend shape, and
          recovery path can be the difference between a useful forecast and a misleading one. LevX
          makes those dimensions tradable.
        </P>
      </Section>

      <Section id="current-scope" num="04" heading="Current scope">
        <P>
          The current public scope is Mode 1: fully collateralized path markets in devnet beta. Mode
          2 liquidity, leverage, and levUSD vault mechanics are roadmap features, not live liquidity
          products.
        </P>
      </Section>
    </>
  )
}

function ProblemContent() {
  return (
    <>
      <Section id="endpoint-loss" num="01" heading="Endpoint loss">
        <P>
          Most prediction markets reduce a forecast to a final yes/no result or a terminal price
          bucket. That misses the behavior that often matters most: how price arrived there.
        </P>
        <P>
          A market can finish at the expected level while taking a route that invalidates the
          original thesis. A trader who predicted a slow grind up and a trader who predicted a deep
          crash followed by recovery should not receive identical treatment.
        </P>
      </Section>

      <Section id="timing-risk" num="02" heading="Timing and path risk">
        <P>
          Directional instruments can be right on destination and wrong on path. They often fail to
          capture drawdowns, time-to-target, volatility texture, or whether the market briefly moved
          through a risk zone.
        </P>
      </Section>

      <Section id="ai-gap" num="03" heading="AI signal gap">
        <P>
          AI systems can generate richer forecasts than a single target price, but most markets have
          no native way to test or monetize those path-shaped forecasts. LevX gives those forecasts
          an on-chain evaluation surface.
        </P>
      </Section>

      <Section id="settlement-gap" num="04" heading="Settlement gap">
        <P>
          A richer market is only useful if settlement stays transparent. LevX solves for that by
          storing paths on-chain, recording oracle checkpoints, and using deterministic scoring
          rules rather than subjective review.
        </P>
      </Section>
    </>
  )
}

function SolutionContent() {
  return (
    <>
      <Section id="path-markets" num="01" heading="Path markets">
        <P>
          A LevX market is a set of routes, not a single final answer. Each route is represented as
          checkpoint prices on a <Code>PathOutcome</Code> account. Users can back the route they
          believe best describes the future market path.
        </P>
      </Section>

      <Section id="scoring" num="02" heading="Richer scoring">
        <P>
          LevX scores the full route. It looks at checkpoint-by-checkpoint price error, velocity
          error, and higher-level features such as volatility texture, drawdown, endpoint accuracy,
          and displacement.
        </P>
      </Section>

      <Section id="market-design" num="03" heading="Market design">
        <P>
          Mode 1 markets are pool-funded and fully collateralized. The market tracks path shares,
          total pool, oracle progress, amplitudes, and settlement denominators on-chain.
        </P>
        <Note kind="tip">
          The result is a market that rewards useful shape information without depending on a
          centralized judge.
        </Note>
      </Section>

      <Section id="mode2" num="04" heading="Mode 2 roadmap">
        <P>
          Mode 2 is the planned liquidity and leverage layer. It is designed around a senior vault,
          pair-level buffers, and conservative profit haircuts, but it remains a roadmap feature
          until implementation and audit work are complete.
        </P>
      </Section>
    </>
  )
}

function GettingStartedContent() {
  return (
    <>
      <Section id="open-app" num="01" heading="Open the app">
        <P>
          The current LevX interface is the web app. Start from the market list, then open a market
          to inspect its path set, chart, checkpoint progress, and available actions.
        </P>
      </Section>

      <Section id="browse-markets" num="02" heading="Browse markets">
        <P>
          Markets are grouped by lifecycle state: Pending, Active, Sampling, Settling, Maturing,
          Settled, or Void. Active and Sampling markets are the states where path backing can be
          available, subject to the market's configuration.
        </P>
      </Section>

      <Section id="read-paths" num="03" heading="Read paths">
        <P>
          Each path is a forecast curve across the market's checkpoint schedule. The path row shows
          market activity, while the chart shows how the forecast compares to observed price history
          and live price context.
        </P>
      </Section>

      <Section id="connect-wallet" num="04" heading="Connect a wallet">
        <P>
          Wallet-gated actions use the connected Solana wallet to sign Anchor transactions. The
          frontend fetches market accounts, derives program addresses, builds instructions, and asks
          the wallet to sign. The web app is the supported user interface today.
        </P>
        <Note>
          Public CLI, npm SDK, and production indexed HTTP API docs should remain planned until
          those interfaces are released.
        </Note>
      </Section>

      <Section id="claim" num="05" heading="Claim settled payouts">
        <P>
          After a market reaches Settled, eligible positions can claim directly from
          program-controlled escrow. If a market is Void, the claim path handles collateral return
          according to protocol rules.
        </P>
      </Section>
    </>
  )
}

function UseCasesContent() {
  return (
    <>
      <Section id="trading" num="01" heading="Path-aware trading">
        <P>
          Traders can express views like "range-bound then breakout", "sharp drawdown then
          recovery", or "steady trend with low volatility" instead of collapsing the thesis into a
          single terminal price.
        </P>
      </Section>

      <Section id="research" num="02" heading="Forecast research">
        <P>
          Analysts can compare path forecasts against realized market behavior with more resolution
          than win/loss. This is useful for studying timing, volatility, drawdown, and regime
          change.
        </P>
      </Section>

      <Section id="ai-benchmarks" num="03" heading="AI path benchmarks">
        <P>
          AI-generated forecasts can be evaluated on the full route. A model can be strong on
          endpoint but weak on volatility texture, or strong on drawdown timing but weak on final
          displacement. LevX makes those differences measurable.
        </P>
      </Section>

      <Section id="risk" num="04" heading="Risk expression">
        <P>
          Path markets let users express risk scenarios directly. The market is not only "where will
          price end", but "what route is most likely, and how much path risk is the market
          mispricing".
        </P>
      </Section>
    </>
  )
}

function ProtocolOverviewContent() {
  return (
    <>
      <Section id="system" num="01" heading="System components">
        <CodeBlock language="system">{`Anchor program
  Market, PathOutcome, Position, PriceSample, EigenCache, DisputeBond

Keeper layer
  activation, price sampling, dissolution, scoring, finalization

AI pipeline
  candidate path generation and submission

Frontend
  market discovery, charting, wallet-gated transactions, claims`}</CodeBlock>
      </Section>

      <Section id="accounts" num="02" heading="Core accounts">
        <Ul>
          <Li>
            <Code>Market</Code> stores timing, state, pool accounting, amplitudes, scoring config,
            and settlement fields.
          </Li>
          <Li>
            <Code>PathOutcome</Code> stores predicted checkpoint prices and per-path scoring state.
          </Li>
          <Li>
            <Code>Position</Code> stores a user's path exposure, shares, collateral, payout, and
            claim state.
          </Li>
          <Li>
            <Code>PriceSample</Code> stores a market-level oracle checkpoint.
          </Li>
        </Ul>
      </Section>

      <Section id="lifecycle" num="03" heading="Lifecycle">
        <CodeBlock language="state-machine">{`Pending -> Active -> Sampling -> Settling -> Maturing -> Settled
                                      \\-> Void`}</CodeBlock>
        <P>
          The lifecycle is deterministic. Keepers advance the market, but the program verifies
          account relationships, state constraints, checkpoint counts, and finalization rules.
        </P>
      </Section>

      <Section id="trust-boundary" num="04" heading="Trust boundary">
        <P>
          AI and keepers are useful services, not settlement authorities. The AI proposes paths.
          Keepers relay data and crank state. The Solana program controls which state transitions,
          scores, disputes, and claims are valid.
        </P>
      </Section>
    </>
  )
}

function QuantumScoringEngineContent() {
  return (
    <>
      <Section id="path-scoring" num="01" heading="Path scoring">
        <P>
          LevX uses an action-style scoring model. At each checkpoint, it compares predicted price
          and predicted velocity against the observed oracle price and realized velocity.
        </P>
        <CodeBlock language="math">{`delta_p = abs(predicted_price - actual_price) / actual_price
delta_v = abs(predicted_velocity - actual_velocity) / actual_price

checkpoint_action = alpha * delta_p^2 + beta * delta_v^2
cumulative_action += checkpoint_action

action_score = SCALE * exp(-cumulative_action / reference_action)`}</CodeBlock>
      </Section>

      <Section id="amplitudes" num="02" heading="Amplitudes">
        <P>
          Every path carries an amplitude. As observed prices diverge from a path, that path loses
          amplitude. If its Born probability falls below the minimum threshold, it dissolves and can
          receive a graceful partial payout based on survival time and peak popularity.
        </P>
      </Section>

      <Section id="pricing" num="03" heading="Pricing">
        <P>
          The baseline pricing layer is LS-LMSR. When <Code>lambda = 0</Code>, or when no fresh
          quantum cache is supplied, the protocol falls back to standard LS-LMSR behavior with no
          inter-path correlation.
        </P>
      </Section>

      <Section id="quantum-cache" num="04" heading="Quantum cache">
        <P>
          When <Code>lambda &gt; 0</Code> and a fresh <Code>EigenCache</Code> is available, the
          protocol can use a quantum-inspired correlated-path pricing layer. A keeper computes an
          eigendecomposition off-chain, submits it, and the program verifies it before the cache is
          used.
        </P>
        <CodeBlock language="dispatch">{`Fresh EigenCache and lambda > 0:
  correlated-path pricing with cached eigendecomposition

No fresh cache or lambda = 0:
  LS-LMSR fallback`}</CodeBlock>
      </Section>

      <Section id="not-quantum-computer" num="05" heading="What it is not">
        <P>
          LevX is not running on a physical quantum computer. The protocol uses quantum-inspired
          math: amplitudes, Born-probability-style dissolution, and an optional correlated-pricing
          cache. This keeps execution feasible on Solana while preserving a richer path-market
          model.
        </P>
      </Section>
    </>
  )
}

function AiPipelineContent() {
  return (
    <>
      <Section id="role" num="01" heading="Role of AI">
        <P>
          AI is used to generate candidate price paths. It does not decide market outcomes, control
          payouts, or replace the oracle. Once a path is submitted, it competes under the same
          scoring rules as every other path.
        </P>
      </Section>

      <Section id="generation" num="02" heading="Path generation">
        <P>
          The intended generation process is regime-aware. The pipeline can propose trend, range,
          high-volatility, drawdown, and recovery-shaped routes so markets start with a useful set
          of differentiated forecasts.
        </P>
      </Section>

      <Section id="onchain-boundary" num="03" heading="On-chain boundary">
        <P>
          AI-origin paths are timestamped and freshness-checked at activation. The program validates
          path coverage and rejects stale or future AI timestamps. Settlement still depends on
          oracle checkpoints and deterministic scoring, not AI trust.
        </P>
      </Section>

      <Section id="feedback-loop" num="04" heading="Feedback loop">
        <P>
          LevX produces feature-level errors: endpoint, displacement, drawdown, volatility texture,
          and checkpoint action. Those outputs can become a cleaner training signal for future path
          generators than a binary correct/incorrect label.
        </P>
      </Section>
    </>
  )
}

function CoreArchitectureContent() {
  return (
    <>
      <Section id="account-model" num="01" heading="Account model">
        <CodeBlock language="pda">{`ProtocolState: ["protocol"]
Market:        ["market", market_id]
PathOutcome:   ["path", market_id, path_index]
Position:      ["position", market_id, user, path_index]
PriceSample:   ["sample", market_id, checkpoint_index]
EigenCache:    ["eigen", market_id]`}</CodeBlock>
      </Section>

      <Section id="state-machine" num="02" heading="State machine">
        <P>
          Markets move through Pending, Active, Sampling, Settling, Maturing, Settled, and Void. The
          maturity window creates time for settlement verification before claims open.
        </P>
      </Section>

      <Section id="keepers" num="03" heading="Keepers and oracles">
        <P>
          Keepers activate markets, submit checkpoint samples, run dissolution and scoring work, and
          finalize markets. Pyth-backed samples provide the price data that settlement consumes.
        </P>
      </Section>

      <Section id="settlement" num="04" heading="Settlement and disputes">
        <P>
          Settlement computes path scores, allocates the distributable pool, and opens claims after
          maturity. Bonded disputes can pause finalization for governance review, and timeout
          finalization prevents unresolved disputes from freezing the market indefinitely.
        </P>
      </Section>
    </>
  )
}

function WhitepaperContent() {
  return (
    <>
      <Section id="scope" num="01" heading="Scope">
        <P>
          The LevX whitepaper will cover the path-market thesis, protocol design, scoring model,
          AI-path architecture, and planned Mode 2 liquidity system.
        </P>
      </Section>

      <Section id="contents" num="02" heading="Planned contents">
        <Ul>
          <Li>Path-prediction market model.</Li>
          <Li>Quantum-inspired scoring and amplitude mechanics.</Li>
          <Li>LS-LMSR and optional correlated-path pricing.</Li>
          <Li>AI path-generation and evaluation loop.</Li>
          <Li>Mode 2 vault and risk-control roadmap.</Li>
        </Ul>
      </Section>

      <Section id="availability" num="03" heading="Availability">
        <P>
          The whitepaper is in drafting. Until publication, these docs are the public technical
          reference for the current beta surface.
        </P>
      </Section>
    </>
  )
}

function RoadmapContent() {
  return (
    <>
      <Section id="mode1" num="01" heading="Mode 1">
        <P>
          Mode 1 focuses on fully collateralized path markets: market creation, path submission,
          oracle checkpoint sampling, scoring, disputes, settlement, and claims.
        </P>
      </Section>

      <Section id="hardening" num="02" heading="Hardening">
        <P>
          The next workstream is production hardening: dependency remediation, monitoring,
          operational runbooks, more public docs, frontend polish, and expanded test coverage.
        </P>
      </Section>

      <Section id="mode2" num="03" heading="Mode 2 liquidity">
        <P>
          Mode 2 introduces vault-backed leverage, levUSD-style LP exposure, pair buffers, health
          checks, liquidation, and pro-rata profit haircuts. It should activate only after
          implementation, testing, and audit coverage.
        </P>
      </Section>

      <Section id="mainnet" num="04" heading="Mainnet readiness">
        <P>
          Mainnet readiness requires a final program address, external audit scope, operational
          monitoring, deployed keeper infrastructure, incident procedures, and public risk
          disclosures.
        </P>
      </Section>
    </>
  )
}

function SecurityAuditsContent() {
  return (
    <>
      <Section id="guardrails" num="01" heading="Protocol guardrails">
        <Ul>
          <Li>State transitions are enforced on-chain.</Li>
          <Li>Path ownership, PDA derivation, uniqueness, and full coverage are validated.</Li>
          <Li>AI freshness checks reject stale and future timestamps.</Li>
          <Li>Disputes require a bonded account and configurable dispute policy.</Li>
          <Li>Fees and claims use protocol state rather than frontend constants.</Li>
        </Ul>
      </Section>

      <Section id="testing" num="02" heading="Testing">
        <P>
          The current codebase includes Rust protocol tests, TypeScript keeper checks, frontend
          typechecking, frontend tests, and dependency audit tooling. Public claims should always
          distinguish passing internal verification from an external third-party audit.
        </P>
      </Section>

      <Section id="audits" num="03" heading="Audit status">
        <P>
          LevX has undergone internal security review and remediation. A completed external
          third-party audit has not yet been published. Mainnet-facing documentation should update
          this page when external audit reports are available.
        </P>
      </Section>

      <Section id="disclosures" num="04" heading="Disclosures">
        <P>
          Security issues should be reported through the official project channels once they are
          published. Until then, do not assume mainnet readiness or external audit coverage.
        </P>
      </Section>
    </>
  )
}

function FaqContent() {
  return (
    <>
      <Section id="what-is-path" num="01" heading="What is a path?">
        <P>
          A path is a sequence of predicted prices across a market's checkpoint schedule. LevX
          scores how closely the path tracks realized prices over time.
        </P>
      </Section>

      <Section id="is-ai-trusted" num="02" heading="Is the AI trusted?">
        <P>
          No. AI can propose paths, but it does not control settlement. Paths are evaluated against
          oracle checkpoints by deterministic program logic.
        </P>
      </Section>

      <Section id="is-quantum" num="03" heading="Is this a quantum computer?">
        <P>
          No. LevX uses quantum-inspired math, not physical quantum hardware. The design borrows
          concepts like amplitudes, Born probabilities, and correlated-state pricing while staying
          executable on Solana.
        </P>
      </Section>

      <Section id="is-leverage-live" num="04" heading="Is leverage live?">
        <P>
          No. Leverage and the levUSD vault are Mode 2 roadmap features. Current docs should treat
          them as planned until the full implementation, risk controls, and audits are complete.
        </P>
      </Section>

      <Section id="mainnet" num="05" heading="Is LevX on mainnet?">
        <P>
          The current documentation describes the devnet beta surface. Mainnet status should be
          updated only after deployment, operational readiness, and audit disclosures are complete.
        </P>
      </Section>
    </>
  )
}

function RisksContent() {
  return (
    <>
      <Section id="market-risk" num="01" heading="Market risk">
        <P>
          Path markets can settle against outcomes that differ sharply from user expectations.
          Backing a path can result in partial loss or loss of collateral according to market rules.
        </P>
      </Section>

      <Section id="oracle-risk" num="02" heading="Oracle risk">
        <P>
          LevX depends on oracle checkpoints for settlement. Oracle downtime, low-confidence
          samples, delayed cranks, or extreme market conditions can affect market progression.
        </P>
      </Section>

      <Section id="smart-contract-risk" num="03" heading="Smart contract risk">
        <P>
          Smart contracts can contain bugs. Internal review and tests reduce risk, but they do not
          eliminate it and are not a substitute for published external audit coverage.
        </P>
      </Section>

      <Section id="liquidity-risk" num="04" heading="Liquidity risk">
        <P>
          Mode 1 markets depend on participant-funded pools. Mode 2 liquidity is not live; future
          vault and leverage features would introduce additional liquidity, utilization, and loss
          waterfall risks.
        </P>
      </Section>

      <Section id="stage-risk" num="05" heading="Beta-stage risk">
        <P>
          LevX is in beta-stage development. Features, interfaces, parameters, and documentation may
          change as the protocol is hardened.
        </P>
      </Section>
    </>
  )
}

function LaunchAppContent() {
  return (
    <>
      <Section id="app" num="01" heading="App">
        <P>Open the LevX web app from the main application route.</P>
        <Ul>
          <Li>
            <Link to="/" className="text-ink-strong underline underline-offset-4">
              Launch app
            </Link>
          </Li>
        </Ul>
      </Section>

      <Section id="markets" num="02" heading="Markets">
        <P>To go directly to market discovery, open the markets page.</P>
        <Ul>
          <Li>
            <Link to="/markets" className="text-ink-strong underline underline-offset-4">
              Browse markets
            </Link>
          </Li>
        </Ul>
      </Section>
    </>
  )
}

function GithubContent() {
  return (
    <>
      <Section id="protocol-repo" num="01" heading="Protocol repository">
        <P>
          The protocol repository contains the Solana program, keeper, pipeline code, tests, and
          technical docs.
        </P>
        <Ul>
          <Li>
            <a
              href="https://github.com/Spizzerp/LevXv2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-strong underline underline-offset-4"
            >
              github.com/Spizzerp/LevXv2
            </a>
          </Li>
        </Ul>
      </Section>

      <Section id="frontend-repo" num="02" heading="Frontend repository">
        <P>
          The frontend repository contains the web app and docs surface. Public repository access
          should be linked here once the canonical frontend URL is confirmed.
        </P>
      </Section>
    </>
  )
}

function CommunityContent() {
  return (
    <>
      <Section id="official-links" num="01" heading="Official links">
        <P>
          Official community links will be added when the project publishes canonical social and
          support channels.
        </P>
      </Section>

      <Section id="updates" num="02" heading="Updates">
        <P>
          Until those channels are published, rely on the application, repository, and project team
          communications for official updates.
        </P>
      </Section>
    </>
  )
}

export const DOC_RENDERERS: Record<DocId, () => ReactNode> = {
  introduction: IntroductionContent,
  problem: ProblemContent,
  solution: SolutionContent,
  'getting-started': GettingStartedContent,
  'use-cases': UseCasesContent,
  'protocol-overview': ProtocolOverviewContent,
  'quantum-scoring-engine': QuantumScoringEngineContent,
  'ai-pipeline': AiPipelineContent,
  'core-architecture': CoreArchitectureContent,
  whitepaper: WhitepaperContent,
  roadmap: RoadmapContent,
  'security-audits': SecurityAuditsContent,
  faq: FaqContent,
  risks: RisksContent,
  'launch-app': LaunchAppContent,
  github: GithubContent,
  community: CommunityContent,
}
