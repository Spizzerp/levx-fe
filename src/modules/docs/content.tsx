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
          LevX is a quantum-inspired path prediction engine on Solana. It applies quantum-style
          probability, path dissolution, and correlated pricing to prediction markets.
        </P>
        <P>
          Most prediction markets ask, "Where will price be at expiry?" LevX asks something harder:
          "What path will price take to get there?"
        </P>
      </Section>

      <Section id="how-it-works" num="02" heading="How it works">
        <P>
          Instead of betting on a binary outcome, users choose or draw full future price paths.
          Every market becomes a set of competing possible futures. As real price data arrives, the
          protocol scores which future is closest to reality.
        </P>
        <CodeBlock language="flow">{`1. A market is created for a pair and time window.
2. AI and user-created paths are submitted before activation.
3. Users back paths with collateral.
4. Pyth-backed checkpoints record market reality.
5. LevX scores each path across the full route.
6. Settled markets allow users to claim payouts on-chain.`}</CodeBlock>
        <P>
          After settlement, the interface presents each scored path with a simple{' '}
          <Code>Path Accuracy Score</Code> from 0 to 100. That public score is a readable version of
          the on-chain composite score, which remains stored at fixed-point precision for
          deterministic settlement.
        </P>
      </Section>

      <Section id="quantum-inspired-engine" num="03" heading="Quantum-inspired engine">
        <P>
          Each path has an amplitude. Its probability is derived from a Born-rule-style model. As
          paths deviate from reality, they lose amplitude. If probability drops too far, they
          dissolve.
        </P>
        <P>
          This creates graceful failure. Being wrong early hurts, but being mostly right for most of
          the market can still have value. A path that survives deep into the market can remain
          eligible for partial payout even if it ultimately diverges.
        </P>
        <P>
          The pricing engine can also use correlated-price pathing. Similar paths can influence each
          other, making the market behave more like a distribution of possible futures than a set of
          isolated bets.
        </P>
      </Section>

      <Section id="why-it-matters" num="04" heading="Why it matters">
        <P>
          The result is a new primitive for prediction markets: not "up or down", not only "price
          above X", but trading the shape of price action itself.
        </P>
        <P>LevX turns market prediction into a competition between possible futures.</P>
      </Section>

      <Section id="current-scope" num="05" heading="Current scope">
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
        <P>
          The public result is a <Code>Path Accuracy Score</Code> out of 100. Under the hood, the
          Solana program stores the same result as a fixed-point composite score from 0 to
          1,000,000, so payouts use precise deterministic math while users see a familiar scoring
          scale.
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
      <Section id="devnet-setup" num="00" heading="Devnet quick start">
        <P>
          LevX is currently live on Solana devnet for waitlisted testers. Five steps take you from
          a fresh wallet to a working position:
        </P>
        <P>
          <strong>1. Install a Solana wallet.</strong> Phantom or Solflare both work. Most browser
          extensions auto-detect via Wallet Standard.
        </P>
        <P>
          <strong>2. Switch the wallet to devnet.</strong> Phantom: Settings → Developer settings →
          Change network → Devnet. Solflare: Settings → Network → Devnet.
        </P>
        <P>
          <strong>3. Get devnet SOL.</strong> You need a small amount of SOL for transaction fees.
          Use <code>solana airdrop 1</code> from the Solana CLI, or visit{' '}
          <a href="https://faucet.solana.com" target="_blank" rel="noreferrer noopener">
            faucet.solana.com
          </a>{' '}
          and paste your wallet address.
        </P>
        <P>
          <strong>4. Get test USDC.</strong> Open the Markets page, connect your wallet, sign the
          one-time verification message, then click <em>Request test USDC</em>. The faucet mints
          1,000 test USDC to your wallet (rate-limited to once per 24h).
        </P>
        <P>
          <strong>5. Place a wager and exit/claim.</strong> Open any Active market, pick a path,
          set your collateral, confirm. After settlement, your position appears in the Portfolio
          page where you can claim winnings.
        </P>
        <Note>
          Devnet is a test environment. Funds are not real, and the protocol may be redeployed or
          state may be reset between releases.
        </Note>
      </Section>

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
        <P>
          The current beta focuses on crypto markets, where Pyth-backed checkpoints can verify the
          realized path. This is the first production surface for the broader path-market primitive.
        </P>
      </Section>

      <Section id="prediction-portfolios" num="02" heading="Prediction portfolios">
        <P>
          LevX paths can be used to express portfolio-style predictions. A user may split conviction
          across several routes in one market, backing a base case, a crash-and-recovery case, and a
          low-volatility sideways case at the same time.
        </P>
        <P>
          The same idea can extend into prediction parlay-style products: a combined thesis where
          multiple path conditions need to hold together. For example, one bundle could ask whether
          an asset follows a breakout path while volatility stays below a threshold, or whether two
          related markets follow compatible routes.
        </P>
        <Note>
          Native parlay settlement is a future product direction, not part of the current Mode 1
          beta. The current system supports individual path positions; parlay-style products would
          require additional settlement logic, risk controls, and regulatory review.
        </Note>
      </Section>

      <Section id="ai-benchmarks" num="03" heading="AI path benchmarks">
        <P>
          AI-generated forecasts can be evaluated on the full route. A model can be strong on
          endpoint but weak on volatility texture, or strong on drawdown timing but weak on final
          displacement. LevX makes those differences measurable.
        </P>
      </Section>

      <Section id="research" num="04" heading="Forecast research">
        <P>
          Analysts can compare path forecasts against realized market behavior with more resolution
          than win/loss. This is useful for studying timing, volatility, drawdown, regime change,
          and how different forecasting methods perform under different market conditions.
        </P>
      </Section>

      <Section id="risk" num="05" heading="Risk expression">
        <P>
          Path markets let users express risk scenarios directly. The market is not only "where will
          price end", but "what route is most likely, and how much path risk is the market
          mispricing".
        </P>
      </Section>

      <Section id="non-crypto" num="06" heading="Beyond crypto">
        <P>
          The path-market model is not limited to crypto prices. Any domain with time-indexed
          outcomes, reliable data, and clear settlement rules can use the same core idea: predict
          the route, not only the endpoint.
        </P>
        <Ul>
          <Li>
            Macro paths: inflation, rate expectations, unemployment, or GDP revisions across a
            release schedule.
          </Li>
          <Li>
            Sports and event trajectories: quarter-by-quarter game flow, scoring pace, possession
            swings, or season standings paths where legally supported.
          </Li>
          <Li>
            Weather and energy: temperature curves, power demand, renewable output, or commodity
            inventory paths.
          </Li>
          <Li>
            Business metrics: revenue, user growth, retention, logistics throughput, or product KPI
            trajectories.
          </Li>
        </Ul>
      </Section>

      <Section id="requirements" num="07" heading="Requirements">
        <P>
          Non-crypto applications need domain-specific infrastructure before they can become
          settlement-grade markets: a trusted data source, a checkpoint schedule, clear dispute
          policy, market-specific risk limits, and legal review for the jurisdiction and product
          category.
        </P>
      </Section>
    </>
  )
}

function ProtocolOverviewContent() {
  return (
    <>
      <Section id="foundation" num="01" heading="Foundation">
        <P>
          LevX is built as a set of connected engines, not a single scoring formula. The protocol
          turns candidate price paths into on-chain market objects, prices exposure across those
          paths, samples realized market data, evolves path state through checkpoints, and settles
          claims through deterministic program rules.
        </P>
        <CodeBlock language="system">{`AI and user path generation
  -> on-chain market engine
  -> LS-LMSR and correlated-path pricing
  -> Pyth checkpoint sampling
  -> quantum-inspired path-state evolution
  -> settlement, disputes, and claims`}</CodeBlock>
      </Section>

      <Section id="onchain-engine" num="02" heading="On-chain engine">
        <P>
          The Anchor program is the execution layer. It owns market lifecycle, path registration,
          activation, wagers, exits, checkpoint sampling, dissolution, settlement, disputes, and
          claims. Keepers can submit work, but the program verifies the accounts, timing, state
          transitions, and payout rules before any market state changes.
        </P>
        <Ul>
          <Li>
            <Code>Market</Code> stores timing, state, pool accounting, amplitudes, pricing config,
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
          <Li>
            <Code>EigenCache</Code>, <Code>DisputeConfig</Code>, and <Code>DisputeBond</Code>{' '}
            support correlated pricing, bonded dispute review, and safer finalization.
          </Li>
        </Ul>
      </Section>

      <Section id="math-engine" num="03" heading="Math and pricing engine">
        <P>
          The shared <Code>levx-math</Code> crate is the foundation under the program. It keeps
          fixed-point math, LS-LMSR pricing, path scoring, amplitude updates, quantum-inspired cost
          functions, and matrix/eigen utilities separate from Anchor so the same logic can be used
          by the on-chain program, tests, benchmarks, and verification harnesses.
        </P>
        <CodeBlock language="engine">{`levx-math
  fixed_point    deterministic arithmetic
  lmsr           liquidity-sensitive market pricing
  quantum        amplitudes, decoherence, path probabilities
  quantum_cost   optional correlated-path cost surface
  matrix/eigen   cached eigendecomposition support`}</CodeBlock>
        <P>
          In production flow, LS-LMSR provides the baseline price surface. The quantum-inspired path
          layer updates path probabilities as checkpoints arrive, and an optional fresh{' '}
          <Code>EigenCache</Code> can price correlated paths when enabled.
        </P>
      </Section>

      <Section id="service-layer" num="04" heading="Service layer">
        <P>
          The off-chain services make the protocol usable without becoming settlement authorities.
          The AI pipeline generates candidate paths. The keeper layer activates markets, relays
          Pyth-backed checkpoint data, runs dissolution and scoring cranks, and finalizes markets
          when program conditions are met. The frontend connects users to discovery, path charts,
          wallet-gated transactions, and claims.
        </P>
      </Section>

      <Section id="verification" num="05" heading="Verification and trust boundary">
        <P>
          The trust boundary is intentionally narrow. AI-generated paths, user-submitted paths, and
          keeper actions all have to pass on-chain validation. The repo also includes a growing
          safety layer around the core protocol: Rust tests, keeper TypeScript checks, compute
          benchmarks, QED specs, Kani bounded checks, and audit remediation notes.
        </P>
        <Note>
          LevX uses quantum-inspired market math, not physical quantum execution. The current
          foundation is designed to be deterministic on Solana while leaving room for deeper
          correlated-path pricing and Mode 2 liquidity systems as the protocol matures.
        </Note>
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
          The baseline pricing layer is liquidity-sensitive LMSR. Instead of using a fixed depth
          parameter, LevX lets effective market depth grow with the amount of active path exposure
          in the market.
        </P>
        <CodeBlock language="math">{`price_i = exp(q_i / b) / sum_j exp(q_j / b)
b = alpha * sum(abs(q_j))`}</CodeBlock>
        <P>
          When <Code>lambda = 0</Code>, or when no fresh quantum cache is supplied, the protocol
          falls back to LS-LMSR with no inter-path correlation.
        </P>
      </Section>

      <Section id="thin-liquidity" num="04" heading="Thin-liquidity adaptations">
        <P>
          Vanilla LS-LMSR can be difficult in thin markets because early liquidity is shallow and
          price impact can be extreme. LevX keeps that early sensitivity for price discovery, but
          adds guardrails so the market remains bounded and usable.
        </P>
        <Ul>
          <Li>
            A minimum liquidity floor prevents fresh markets from starting with a zero or undefined{' '}
            <Code>b</Code>.
          </Li>
          <Li>
            Each market can tune <Code>lmsr_alpha</Code>, allowing flatter pricing for markets that
            expect larger early wagers.
          </Li>
          <Li>
            Effective liquidity is calculated from active paths only, so dissolved paths do not keep
            distorting the price surface.
          </Li>
          <Li>
            Path dissolution concentrates attention on surviving routes instead of letting clearly
            stale paths fragment liquidity.
          </Li>
          <Li>
            Oracle-informed LMSR nudges move quantities toward better-tracking paths with an exact
            zero-sum adjustment.
          </Li>
          <Li>
            Slippage floors and zero-cost exposure checks reject trades that would receive fewer
            shares than expected or mint unpaid exposure.
          </Li>
        </Ul>
        <Note>
          These controls do not make thin liquidity disappear. They make thin-market behavior more
          explicit, bounded, and path-aware than raw LS-LMSR alone.
        </Note>
      </Section>

      <Section id="quantum-cache" num="05" heading="Quantum cache">
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

      <Section id="not-quantum-computer" num="06" heading="What it is not">
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
          AI is used to generate candidate price paths before a market opens. It gives each market a
          set of differentiated starting scenarios, but it does not decide outcomes, control
          payouts, or replace the oracle. Once a path is submitted on-chain, it competes under the
          same deterministic scoring rules as every other path.
        </P>
      </Section>

      <Section id="internal-providers" num="02" heading="Internal providers">
        <P>
          The current in-house provider stack uses a foundation-model ensemble built around{' '}
          <Code>TimesFM 2.5</Code> and <Code>Chronos-2</Code>. Chronos-2 provides probabilistic
          samples, TimesFM contributes quantile forecasts, and the ensemble converts those outputs
          into forecast priors for LevX path generation.
        </P>
        <P>
          GPU inference is hosted through RunPod Serverless. The pipeline calls the RunPod worker
          first, and can fall back to local model loading or a statistical baseline if foundation
          inference is unavailable. This keeps market generation operational while allowing the
          foundation-model layer to improve independently.
        </P>
      </Section>

      <Section id="market-flow" num="03" heading="Market generation flow">
        <P>
          When a market is configured, the AI service receives the market pair, start time, end
          time, checkpoint interval, and path freshness window. The scheduler is designed to trigger
          generation shortly before market start so AI-origin paths stay fresh; the authenticated
          generation API can also generate paths for a specific market configuration.
        </P>
        <CodeBlock language="pipeline">{`market config
  -> price data collection
  -> feature engineering
  -> regime detection
  -> TimesFM + Chronos-2 forecast priors
  -> copula or Monte Carlo path generation
  -> K-means selection into representative paths
  -> on-chain add_path submission`}</CodeBlock>
        <P>
          The output is a compact set of representative paths with checkpoint prices, labels,
          initial probabilities, and generation timestamps. Checkpoint prices are stored directly
          on-chain in path accounts, so settlement does not depend on off-chain file storage.
        </P>
      </Section>

      <Section id="onchain-boundary" num="04" heading="On-chain boundary">
        <P>
          AI-origin paths are timestamped and freshness-checked at activation. The program validates
          path coverage and rejects stale or future AI timestamps. Settlement still depends on
          oracle checkpoints and deterministic scoring, not AI trust.
        </P>
      </Section>

      <Section id="provider-roadmap" num="05" heading="Provider roadmap">
        <P>
          The initial phase focuses on validating LevX's internal AI providers before opening the
          market to outside providers. After that validation phase, the roadmap is to let external
          AI providers compete for path positions in markets.
        </P>
        <P>
          Those providers could range from retail AI agents to institutional forecasting systems.
          The goal is a marketplace where models earn distribution by producing paths that survive
          checkpoints, score well against realized prices, and prove useful to traders over time.
        </P>
        <Note>
          External provider registration, provider profiles, and provider leaderboards are planned
          features. They are not part of the current public beta settlement authority.
        </Note>
      </Section>

      <Section id="feedback-loop" num="06" heading="Feedback loop">
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
        <P>
          LevX uses deterministic PDAs for protocol state, markets, paths, positions, oracle
          samples, correlated-pricing caches, and dispute bonds. The hot path is fully on-chain:
          market vaults escrow collateral, path accounts store checkpoint prices directly, and
          position accounts track user exposure and claim state.
        </P>
        <CodeBlock language="pda">{`ProtocolState: ["protocol"]
Market:        ["market", market_id]
PathOutcome:   ["path", market_id, path_index]
Position:      ["position", market_id, user, path_index]
PriceSample:   ["sample", market_id, checkpoint_index]
EigenCache:    ["eigen", market_id]
DisputeConfig: ["dispute_config"]
DisputeBond:   ["dispute_bond", market]`}</CodeBlock>
        <P>
          <Code>ProtocolState</Code> holds authority, fee caps, supported pairs, collateral mint,
          and keeper authority. <Code>Market</Code> holds lifecycle, vault, timing, pricing,
          amplitude, scoring, and settlement state. <Code>PathOutcome</Code> holds each path's
          predicted prices and scoring state. <Code>Position</Code> holds the user's collateral,
          shares, exposure, payout, and claim flag.
        </P>
      </Section>

      <Section id="market-setup" num="02" heading="Market setup">
        <P>
          Market creation starts from a governance-managed pair whitelist. The creator supplies the
          base mint, quote mint, Pyth feed, timing, checkpoint interval, scoring parameters,
          liquidity parameters, path freshness window, and reference action. The program verifies
          the pair/feed match, creates the market vault, charges the creation fee, and enforces a
          checkpoint schedule between 4 and 120 checkpoints.
        </P>
        <P>
          Paths are added while the market is <Code>Pending</Code>. AI-labelled paths require the
          configured keeper authority; user-drawn paths remain permissionless. Each path stores its
          checkpoint prices directly in the <Code>PathOutcome</Code> account, so settlement does not
          depend on Arweave, Merkle proofs, or an off-chain file server.
        </P>
      </Section>

      <Section id="lifecycle" num="03" heading="Lifecycle and keepers">
        <CodeBlock language="state-machine">{`Pending -> Active -> Sampling -> Settling -> Maturing -> Settled
                                      \\-> Void`}</CodeBlock>
        <P>
          Activation is permissionless after the market start time, but it is not automatic. The
          program requires at least three paths, validates that every path account is present
          exactly once, checks canonical path PDAs, and rejects stale or future AI timestamps.
          Activation initializes all paths into an equal quantum-inspired amplitude state.
        </P>
        <P>
          Keepers are cranking infrastructure, not authorities. They can activate markets, sample
          prices, process dissolution, score paths, settle markets, and finalize claims windows, but
          every transition is enforced by the program's state, PDA, oracle, timing, and ownership
          checks.
        </P>
      </Section>

      <Section id="trading-pricing" num="04" heading="Trading and pricing">
        <P>
          Users can place wagers during <Code>Active</Code> and <Code>Sampling</Code> until the 75%
          checkpoint cutoff. Entry fees are split between treasury and insurance, while collateral
          enters the market vault. Each wager mints path exposure, updates the path's wager totals,
          and creates a <Code>Position</Code> PDA for the user and path.
        </P>
        <P>
          Pricing uses a two-tier dispatch. If <Code>lambda &gt; 0</Code> and a fresh{' '}
          <Code>EigenCache</Code> is supplied, the trade uses a cached correlated-path quadratic
          payment rule. Otherwise it falls back to LS-LMSR over active paths only. Wagers use{' '}
          <Code>min_shares_out</Code> slippage protection, and exits use <Code>min_payout_out</Code>{' '}
          protection after rake.
        </P>
      </Section>

      <Section id="checkpoints" num="05" heading="Checkpoints and path evolution">
        <P>
          The primary production checkpoint path is <Code>sample_and_dissolve</Code>. It verifies a
          Pyth PriceUpdate account, checks the market feed and publish-time grace window, normalizes
          price and confidence, stores a <Code>PriceSample</Code>, and advances the checkpoint
          counter.
        </P>
        <P>
          The same instruction can process all supplied path PDAs for that checkpoint. For each
          path, the program verifies ownership, writability, canonical PDA seeds, uniqueness, and
          market linkage. It then computes action error from price and velocity, halves the weight
          for low-confidence oracle samples, accumulates feature data, applies decoherence, and
          renormalizes amplitudes.
        </P>
        <P>
          If a path's Born-style probability falls below the market's minimum threshold, the path
          dissolves. Dissolution zeros its amplitude and pricing quantity, records the checkpoint,
          emits an event, and makes the path eligible for a partial payout based on survival time
          and peak amplitude. Surviving paths can also receive zero-sum LMSR nudges toward
          better-tracking routes.
        </P>
      </Section>

      <Section id="settlement" num="06" heading="Settlement, disputes, and claims">
        <P>
          After the final checkpoint, surviving paths are scored one by one. The score starts with
          exponential action scoring, <Code>exp(-action / reference_action)</Code>, then applies
          optional feature penalties for quadratic variation, drawdown, endpoint error, and
          displacement error. The market accumulates ELF-weighted denominators; with{' '}
          <Code>reference_score = 0</Code>, this behaves like standard proportional parimutuel
          settlement.
        </P>
        <P>
          Once all surviving paths are scored, settlement opens a maturity window. Any signer can
          dispute during that window by locking the configured bond. Governance can uphold a
          dispute, void the market, and return the bond, or reject the dispute and slash the bond to
          insurance. If governance does not act before the review timeout, permissionless timeout
          finalization slashes the bond and settles the market.
        </P>
        <P>
          Claims open once the market is <Code>Settled</Code> or <Code>Void</Code>. Void markets
          return collateral. Dissolved paths receive their decoherence payout. Surviving paths share
          the distributable pool according to score contribution and time-weighted exposure, with
          settlement rake routed to treasury and insurance.
        </P>
      </Section>

      <Section id="boundaries" num="07" heading="Current boundaries">
        <P>
          The current public beta is Mode 1: fully collateralized path markets. Leverage-related
          fields and the <Code>LevVault</Code> account exist in the program, but Mode 2 borrowing,
          pair buffers, liquidations, and vault-risk mechanics are dormant until governance enables
          that roadmap.
        </P>
        <Note>
          The current on-chain path origin model records protocol AI and user-drawn paths. External
          AI provider competition is planned as a future marketplace layer after the internal
          providers are validated.
        </Note>
      </Section>
    </>
  )
}

function WhitepaperContent() {
  return (
    <>
      <Section id="abstract" num="01" heading="Abstract">
        <P>
          LevX is a path-prediction market protocol on Solana. It expands prediction markets beyond
          endpoint outcomes by making the full price route tradable: trend shape, drawdown,
          volatility texture, recovery timing, and final displacement all become part of the market
          object.
        </P>
        <P>
          The current protocol is a fully collateralized Mode 1 system. Users back competing paths
          with collateral, Pyth-backed checkpoints record realized prices, and deterministic
          on-chain logic scores, dissolves, settles, disputes, and pays claims. Future roadmap work
          expands this foundation into external AI provider competition and Mode 2 liquidity.
        </P>
      </Section>

      <Section id="thesis" num="02" heading="Thesis">
        <P>
          Most market products compress a rich time series into a single terminal value. That loses
          information. Two forecasts can end at the same price while implying very different risk:
          one may grind upward steadily, while another may crash, recover, and finish at the same
          endpoint.
        </P>
        <P>
          LevX treats the route itself as the primitive. A path forecast is scored against observed
          checkpoints, not only the final print. This creates a native market for timing,
          volatility, drawdown, regime changes, and AI-generated scenario quality.
        </P>
        <CodeBlock language="thesis">{`Endpoint market:
  "Where does the asset finish?"

Path market:
  "How does the asset get there?"`}</CodeBlock>
      </Section>

      <Section id="market-model" num="03" heading="Market model">
        <P>
          A LevX market is created for a token pair and time window. Before activation, AI and
          user-created paths are submitted as on-chain <Code>PathOutcome</Code> accounts. Each path
          stores predicted prices for every checkpoint, plus origin, probability, scoring, wager,
          and dissolution state.
        </P>
        <P>
          Once active, users choose the path or paths they want to back. A position represents
          collateral, path shares, cost basis, entered checkpoint, and claim state. Users may hold
          positions across multiple paths in the same market, enabling diversified path theses
          instead of a single binary wager.
        </P>
        <CodeBlock language="flow">{`market configuration
  -> candidate paths
  -> user-backed path exposure
  -> oracle checkpoints
  -> path scoring and dissolution
  -> settlement and claims`}</CodeBlock>
      </Section>

      <Section id="protocol-architecture" num="04" heading="Protocol architecture">
        <P>
          The on-chain program owns the market lifecycle. It creates markets, validates supported
          pairs, stores path checkpoint prices, escrows collateral, samples oracle checkpoints,
          updates path state, scores surviving paths, handles disputes, and opens claims.
        </P>
        <Ul>
          <Li>
            <Code>ProtocolState</Code> stores authority, fee caps, supported pairs, collateral mint,
            and keeper authority.
          </Li>
          <Li>
            <Code>Market</Code> stores lifecycle, timing, vault, pricing, amplitude, scoring, and
            settlement fields.
          </Li>
          <Li>
            <Code>PathOutcome</Code> stores predicted checkpoint prices and path-level scoring
            state.
          </Li>
          <Li>
            <Code>Position</Code> stores a user's path exposure, shares, collateral, payout, and
            claim status.
          </Li>
          <Li>
            <Code>PriceSample</Code>, <Code>EigenCache</Code>, <Code>DisputeConfig</Code>, and{' '}
            <Code>DisputeBond</Code> support checkpoint sampling, correlated pricing, and bounded
            dispute review.
          </Li>
        </Ul>
      </Section>

      <Section id="pricing" num="05" heading="Pricing">
        <P>
          LevX uses liquidity-sensitive LMSR as its baseline pricing layer. Effective market depth
          grows with active path exposure, rather than using one fixed liquidity parameter for the
          entire market. This keeps early markets sensitive enough for price discovery while giving
          deeper markets more stable pricing.
        </P>
        <CodeBlock language="math">{`price_i = exp(q_i / b) / sum_j exp(q_j / b)
b = alpha * sum(abs(q_j))`}</CodeBlock>
        <P>
          The implementation adds thin-liquidity guardrails: a minimum liquidity floor, configurable{' '}
          <Code>lmsr_alpha</Code>, active-path-only liquidity, dissolution-aware pricing, slippage
          checks, and zero-cost exposure protections.
        </P>
        <P>
          When <Code>lambda &gt; 0</Code> and a fresh <Code>EigenCache</Code> is supplied, the
          protocol can use an optional correlated-path pricing surface. Without that cache, or when{' '}
          <Code>lambda = 0</Code>, pricing falls back to LS-LMSR.
        </P>
      </Section>

      <Section id="scoring" num="06" heading="Scoring and settlement">
        <P>
          At each checkpoint, LevX compares each path's predicted price and predicted velocity
          against the realized oracle price and realized velocity. The program accumulates an
          action-style error score over time.
        </P>
        <CodeBlock language="math">{`checkpoint_action = alpha * delta_price^2 + beta * delta_velocity^2
cumulative_action += checkpoint_action

action_score = SCALE * exp(-cumulative_action / reference_action)`}</CodeBlock>
        <P>
          The action score is then modulated by feature-level errors: quadratic variation, maximum
          drawdown, endpoint error, and displacement error. These features reward routes that track
          the realized market shape, not only the final price.
        </P>
        <P>
          For users, this is displayed as a <Code>Path Accuracy Score</Code> from 0 to 100. For the
          program, the same value remains a fixed-point <Code>compositeScore</Code> from 0 to
          1,000,000, preserving settlement precision.
        </P>
        <P>
          Path state also evolves through amplitudes. If a path's Born-style probability falls below
          the configured threshold, it dissolves, exits the active price surface, and becomes
          eligible for a partial payout based on survival time and peak amplitude.
        </P>
        <P>
          Settlement uses ELF-compatible weighted denominators. In the current default
          configuration, <Code>reference_score = 0</Code>, which behaves like proportional
          parimutuel settlement. Governance can later calibrate a positive reference score from real
          market data.
        </P>
      </Section>

      <Section id="ai-layer" num="07" heading="AI path layer">
        <P>
          The internal AI pipeline generates candidate paths before market activation. The current
          in-house ensemble uses <Code>TimesFM 2.5</Code> and <Code>Chronos-2</Code>, hosted through
          RunPod Serverless for GPU inference.
        </P>
        <P>
          The generation flow collects price history, computes features, detects market regime,
          calls the foundation-model ensemble for forecast priors, generates candidate paths through
          copula or Monte Carlo methods, clusters representative routes, labels them, and submits
          checkpoint prices on-chain through <Code>add_path</Code>.
        </P>
        <Note>
          AI is not a settlement authority. It proposes paths. Pyth checkpoints and on-chain scoring
          decide outcomes.
        </Note>
      </Section>

      <Section id="trust-security" num="08" heading="Trust and security">
        <P>
          LevX narrows the trust boundary around the Solana program and Pyth price data. AI
          services, keepers, and frontend clients are useful infrastructure, but they do not decide
          payouts. The program verifies account ownership, PDA derivations, checkpoint timing,
          supported pairs, path freshness, fee caps, dispute state, and one-shot claims.
        </P>
        <P>
          The repository includes a growing safety layer around the protocol: Rust tests, keeper
          TypeScript checks, compute benchmarks, QED specs, Kani bounded checks, audit remediation
          notes, and public risk documentation. This does not remove market, oracle, smart-contract,
          liquidity, or operational risk; it defines the engineering controls used to reduce them.
        </P>
      </Section>

      <Section id="roadmap" num="09" heading="Roadmap">
        <P>
          The current beta focuses on Mode 1: fully collateralized path markets with on-chain
          scoring, disputes, and claims. The next product and protocol milestones are production
          hardening, monitoring, broader public docs, better market UX, deeper test coverage, and
          validation of the internal AI path providers.
        </P>
        <P>
          After internal validation, LevX plans to open path competition to external AI providers.
          These may range from retail AI agents to institutional forecasting systems. Provider
          registration, provider profiles, and leaderboards are planned marketplace features.
        </P>
        <P>
          Mode 2 liquidity is a later roadmap phase. The program already contains dormant vault and
          leverage fields, but borrowing, pair buffers, liquidations, and vault-risk mechanics
          should activate only after implementation, dedicated testing, monitoring, and audit
          coverage.
        </P>
      </Section>
    </>
  )
}

function RoadmapContent() {
  return (
    <>
      <Section id="mode1-beta" num="01" heading="Mode 1 beta">
        <P>
          The current product surface is Mode 1: fully collateralized path markets. Markets support
          creation, path submission, activation, LS-LMSR path trading, Pyth checkpoint sampling,
          decoherence, scoring, bonded disputes, settlement, and claims.
        </P>
        <P>
          Mode 1 is self-contained by design. Payouts come from the market pool, users do not borrow
          from a protocol vault, and there is no liquidation risk. This phase validates the core
          path primitive before adding leverage or external model marketplaces.
        </P>
      </Section>

      <Section id="hardening" num="02" heading="Production hardening">
        <P>
          The next workstream is hardening the system around the current protocol surface. That
          includes dependency remediation, keeper monitoring, operational runbooks, release
          procedures, incident response, better frontend states, expanded test coverage, and clearer
          public risk disclosures.
        </P>
        <P>
          This phase also tightens the verification story: Rust protocol tests, keeper TypeScript
          checks, compute benchmarks, QED/Kani coverage, audit remediation notes, and external audit
          preparation should remain aligned with the public claims in these docs.
        </P>
      </Section>

      <Section id="ai-validation" num="03" heading="AI validation">
        <P>
          LevX's internal AI path providers are the first models to compete inside markets. The
          current pipeline uses TimesFM 2.5 and Chronos-2 through RunPod-hosted inference, then
          converts forecast priors into representative paths that are submitted on-chain before
          activation.
        </P>
        <P>
          The validation goal is not simply to generate plausible charts. The goal is to measure how
          model paths perform after settlement: endpoint accuracy, drawdown behavior, volatility
          texture, displacement, checkpoint action, survival rate, and score distribution by market
          regime.
        </P>
      </Section>

      <Section id="provider-marketplace" num="04" heading="Provider marketplace">
        <P>
          After the internal providers are validated, LevX plans to open path competition to
          external AI providers. These providers may include retail AI agents, independent quant
          systems, institutional forecasting models, and specialized market-specific predictors.
        </P>
        <P>
          The planned marketplace layer includes provider registration, provider identity, path-slot
          competition, performance history, and leaderboards. The protocol direction is simple:
          models should earn distribution by producing paths that survive checkpoints, score well,
          and create useful markets for traders.
        </P>
        <Note>
          External provider registration and leaderboards are roadmap features. They are not current
          settlement authorities and should not be presented as live beta functionality.
        </Note>
      </Section>

      <Section id="liquidity" num="05" heading="Liquidity expansion">
        <P>
          Mode 1 markets are fully collateralized, but they still benefit from better liquidity,
          better market curation, and tighter path diversity. Near-term liquidity work focuses on
          improving participation, bootstrapping higher-quality markets, and studying external
          liquidity strategies without changing the core solvency model.
        </P>
        <P>
          This track is separate from Mode 2 leverage. Liquidity bootstrapping should deepen the
          market experience without bypassing escrow, pricing, scoring, or settlement rules enforced
          by the Solana program.
        </P>
      </Section>

      <Section id="mode2" num="06" heading="Mode 2 leverage">
        <P>
          Mode 2 is the planned leveraged liquidity layer. The program already contains dormant
          vault and leverage fields, but current wagers are Mode 1 positions with leverage set to
          one. The Mode 2 roadmap introduces vault-backed borrowing, levUSD-style LP exposure, pair
          buffers, health checks, liquidation, warmup accounting, and pro-rata profit haircuts.
        </P>
        <P>
          This phase should only activate after the missing instruction set is implemented, the
          account model is reviewed for any required versioning, keeper flows are tested, telemetry
          is added, and a focused external audit covers vault solvency, liquidation, haircut,
          warmup, and pair-buffer behavior.
        </P>
      </Section>

      <Section id="mainnet-governance" num="07" heading="Mainnet and governance">
        <P>
          Mainnet readiness requires more than deploying the program. It requires a final audited
          release, verifiable build artifacts, deployed keeper infrastructure, monitoring and
          alerting coverage, incident procedures, public risk disclosures, liquidity and
          market-creation policy, and operational ownership for upgrades and emergencies.
        </P>
        <P>
          Governance should expand after the protocol has enough real market data to calibrate fees,
          scoring thresholds, provider reputation, pair onboarding, and Mode 2 risk parameters.
          Until then, governance claims should remain conservative and tied to concrete deployed
          controls.
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
        <P>The frontend repository contains the web app and docs surface.</P>
        <Ul>
          <Li>
            <a
              href="https://github.com/Spizzerp/levx-fe"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-strong underline underline-offset-4"
            >
              github.com/Spizzerp/levx-fe
            </a>
          </Li>
        </Ul>
      </Section>

      <Section id="infra-repo" num="03" heading="Infrastructure repository">
        <P>
          The infrastructure repository contains deployment, keeper, and operational infrastructure
          work that supports the LevX application and protocol.
        </P>
        <Ul>
          <Li>
            <a
              href="https://github.com/Spizzerp/levx-infra"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-strong underline underline-offset-4"
            >
              github.com/Spizzerp/levx-infra
            </a>
          </Li>
        </Ul>
      </Section>
    </>
  )
}

function CommunityContent() {
  return (
    <>
      <Section id="official-links" num="01" heading="Official links">
        <P>
          Follow the official LevX X account for public announcements, product updates, and docs
          releases.
        </P>
        <Ul>
          <Li>
            <a
              href="https://x.com/LevXtrade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-strong underline underline-offset-4"
            >
              x.com/LevXtrade
            </a>
          </Li>
        </Ul>
      </Section>

      <Section id="updates" num="02" heading="Updates">
        <P>
          Additional community channels may be added later. Until then, the X account, application,
          repository, and docs should be treated as the canonical public update surfaces.
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
