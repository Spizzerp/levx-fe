import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Code, CodeBlock, Li, Note, P, Section, Ul } from './primitives'
import type { DocId } from './types'
import { DOC_META } from './data'

function IntroductionContent() {
  return (
    <>
      <Section id="what-is-levx" num="01" heading="What is LevX?">
        <P>
          LevX is a path-prediction market protocol on Solana. Instead of asking
          you to predict only whether an asset ends higher or lower, LevX lets
          you trade on the <em>shape</em> of price movement over time. A market
          is a set of competing routes through the next few hours or days; you
          back the route you believe the market will follow.
        </P>
        <P>
          The protocol settles each route against verified oracle checkpoints,
          so a path can be partially right — close on direction but wrong on
          volatility — and still earn a graceful payout.
        </P>
      </Section>

      <Section id="why-paths" num="02" heading="Why paths instead of prices?">
        <P>
          Most prediction markets collapse the future into a binary outcome or a
          single terminal bucket. That throws away almost everything traders
          actually disagree about: trend, drawdown, recovery shape, timing.
        </P>
        <Note kind="tip">
          A path is a richer language than a price. Two predictions can share
          the same endpoint and still tell completely different stories. LevX
          scores the journey, not just the destination.
        </Note>
      </Section>

      <Section id="how-it-works" num="03" heading="How it works">
        <P>
          Every market is composed of five lifecycle phases. The keeper layer
          advances each phase deterministically; the protocol does not need a
          centralized referee.
        </P>
        <CodeBlock language="lifecycle">{`Created  →  Sampling  →  Settling  →  Disputable  →  Claimable
   ·          ·            ·             ·              ·
seeded     oracle       last         24h grace      pay out
paths     checkpoints   tick         window        on-chain`}</CodeBlock>
        <P>
          Five AI-generated paths seed each market at creation; users can draw
          their own paths and stake them alongside. Both kinds are first-class
          on-chain objects — accounts, not opinions.
        </P>
      </Section>

      <Section id="what-you-can-do" num="04" heading="What you can do today">
        <Ul>
          <Li>
            Discover open path markets on the{' '}
            <Link
              to="/markets"
              className="text-ink-strong underline underline-offset-4"
            >
              Markets
            </Link>{' '}
            page.
          </Li>
          <Li>Place a wager on any AI-generated path with one click.</Li>
          <Li>
            Draw your own path on the chart and back it against the AI rail.
          </Li>
          <Li>Watch your position score live as oracle checkpoints arrive.</Li>
          <Li>
            Provide passive liquidity to the vault and earn from market spread.
          </Li>
        </Ul>
      </Section>

      <Section id="further-reading" num="05" heading="Further reading">
        <P>
          The rest of these docs are organized like a Git man page. Skim the{' '}
          <Code>00 — Getting Started</Code> rail to ship your first wager, or
          jump to <Code>01 — Protocol</Code> for the mechanics.
        </P>
      </Section>
    </>
  )
}

function QuickStartContent() {
  return (
    <>
      <Section id="install" num="01" heading="Install the CLI">
        <P>
          The <Code>levx</Code> CLI ships as a single binary. Install with your
          favorite package manager — the Solana toolchain is the only system
          dependency.
        </P>
        <CodeBlock language="bash">{`# macOS / Linux
curl -fsSL https://get.levx.trade | sh

# Verify
levx --version
# levx 0.1.0 (devnet · build a3f902e)`}</CodeBlock>
        <Note>
          The binary is unsigned during the devnet phase. Read the install
          script before piping it to your shell — it lives in the public{' '}
          <Code>levx-protocol/install</Code> repo.
        </Note>
      </Section>

      <Section id="connect" num="02" heading="Connect a wallet">
        <P>
          LevX uses standard Solana keypairs. Either point the CLI at an
          existing keypair file or generate a fresh one for devnet.
        </P>
        <CodeBlock>{`levx wallet use ~/.config/solana/id.json
# or
levx wallet new --network devnet`}</CodeBlock>
      </Section>

      <Section id="fund" num="03" heading="Fund the devnet account">
        <P>
          Devnet wagers settle in test USDC. The faucet drips up to 100 USDC at
          a time and refills every 24 hours.
        </P>
        <CodeBlock>{`levx faucet --amount 50
# Airdropping 50 USDC to 7Xa…q9F
# Confirmed in slot 312_874_021`}</CodeBlock>
      </Section>

      <Section id="discover" num="04" heading="Discover a market">
        <P>
          List the open markets, then inspect a specific pair. Output is
          machine-friendly TSV by default; pass <Code>--format table</Code> for
          the readable Nothing-style print-out.
        </P>
        <CodeBlock>{`levx markets list --status open --format table

  PAIR        OPENS      MATURES     LEV    PATHS
  BTC/USDC    -2d 03h    +5d 21h     ×25      6
  SOL/USDC    -1d 11h    +6d 13h     ×40      5
  ETH/USDC    -0d 08h    +6d 16h     ×25      6`}</CodeBlock>
      </Section>

      <Section id="wager" num="05" heading="Place your first wager">
        <P>
          Pick a path id from the listing, choose a leverage, and confirm. The
          CLI prints the on-chain signature and a link to the market view.
        </P>
        <CodeBlock>{`levx wager \\
  --market BTC/USDC \\
  --path 03 \\
  --collateral 25 \\
  --leverage 5

  · pre-trade quote     +0.0124 USDC per tick
  · entry checkpoint    312_874_412
  · signature           5h2K…9eF
  · open in browser     https://levx.trade/market/0xabc…`}</CodeBlock>
        <Note kind="tip">
          The protocol scores your position continuously. Run{' '}
          <Code>levx positions watch</Code> to stream live P&amp;L until the
          market matures.
        </Note>
      </Section>
    </>
  )
}

function ConceptsContent() {
  return (
    <>
      <Section id="lexicon" num="01" heading="Lexicon">
        <Ul>
          <Li>
            <strong className="text-ink-strong">Market</strong> — a token pair,
            a start, a maturity, and a set of competing paths.
          </Li>
          <Li>
            <strong className="text-ink-strong">Path</strong> — a sequence of
            predicted prices at fixed checkpoint intervals.
          </Li>
          <Li>
            <strong className="text-ink-strong">Checkpoint</strong> — an oracle
            attestation of the actual price at a specific slot.
          </Li>
          <Li>
            <strong className="text-ink-strong">Wager</strong> — a stake in
            USDC against a single path, with optional leverage.
          </Li>
          <Li>
            <strong className="text-ink-strong">Amplitude</strong> — a path's
            current standing, decayed by checkpoint divergence.
          </Li>
        </Ul>
      </Section>

      <Section id="lifecycle" num="02" heading="Market lifecycle">
        <P>
          Markets move through five deterministic phases driven by the keeper
          layer. Each transition is on-chain and verifiable.
        </P>
        <CodeBlock language="phases">{`Created      paths seeded, market accepts wagers
Sampling     oracle checkpoints arrive each interval
Settling     final checkpoint observed, scores frozen
Disputable   24h window for bonded objections
Claimable    wagers paid out from escrow`}</CodeBlock>
      </Section>

      <Section id="roles" num="03" heading="Roles in the system">
        <Ul>
          <Li>
            <strong className="text-ink-strong">Trader</strong> — places wagers,
            draws paths, claims payouts.
          </Li>
          <Li>
            <strong className="text-ink-strong">Keeper</strong> — relays oracle
            updates and cranks scoring.
          </Li>
          <Li>
            <strong className="text-ink-strong">LP</strong> — provides vault
            liquidity to the LS-LMSR maker.
          </Li>
          <Li>
            <strong className="text-ink-strong">Disputer</strong> — bonds
            collateral to challenge a settlement.
          </Li>
        </Ul>
      </Section>
    </>
  )
}

function PathMarketsContent() {
  return (
    <>
      <Section id="shape" num="01" heading="The shape of a market">
        <P>
          A path market is a small constellation of on-chain accounts: the{' '}
          <Code>PathMarket</Code> root, one <Code>Path</Code> per route, and one{' '}
          <Code>Checkpoint</Code> per oracle observation. The root holds escrow;
          the paths hold predictions; the checkpoints hold reality.
        </P>
        <CodeBlock language="layout">{`PathMarket  ─┬─  Path 01  ─┬─ Checkpoint 0
             │            ├─ Checkpoint 1
             │            └─ … (n)
             ├─  Path 02  ─┬─ Checkpoint 0
             │            └─ …
             └─  Path 03  ─┬─ Checkpoint 0
                          └─ …`}</CodeBlock>
      </Section>

      <Section id="paths" num="02" heading="Paths">
        <P>
          A path is just a sorted list of price points at the market's checkpoint
          interval. Five are seeded by the AI generator at creation; users can
          add their own by drawing on the chart and submitting an{' '}
          <Code>add_path</Code> instruction.
        </P>
        <Note>
          AI-seeded and user-drawn paths are indistinguishable at the program
          level. The protocol does not privilege the AI rail — it only publishes
          a baseline so the market is liquid on day one.
        </Note>
      </Section>

      <Section id="checkpoints" num="03" heading="Checkpoints">
        <P>
          Each checkpoint is a Pyth attestation written into a per-path account.
          The interval is fixed at market creation (typically 1h) and cannot be
          changed retroactively. A market with 168 checkpoints over 7 days
          produces a 168-element score vector per path.
        </P>
      </Section>

      <Section id="amplitudes" num="04" heading="Path amplitudes">
        <P>
          Every path carries an amplitude — a value in <Code>[0, 1]</Code> that
          decays as observed prices diverge from the prediction. Settled payouts
          are proportional to the integral of this amplitude over the market's
          life, not just its terminal value.
        </P>
      </Section>
    </>
  )
}

function ScoringEngineContent() {
  return (
    <>
      <Section id="inputs" num="01" heading="Inputs">
        <Ul>
          <Li>
            The path's predicted price at checkpoint <Code>t</Code>.
          </Li>
          <Li>
            The oracle's observed price at checkpoint <Code>t</Code>.
          </Li>
          <Li>The pair's reference volatility window.</Li>
        </Ul>
      </Section>
      <Section id="formula" num="02" heading="Scoring formula">
        <P>
          The per-checkpoint score is an exponential of the squared z-score
          divergence between prediction and observation:
        </P>
        <CodeBlock language="math">{`score_t = exp(- (Δ_t / σ)²)
  Δ_t = predicted_t - observed_t
  σ   = pair volatility window`}</CodeBlock>
      </Section>
      <Section id="decay" num="03" heading="Decoherence and decay">
        <P>
          Repeated divergence multiplies down a path's amplitude through a
          decoherence coefficient. A path that misses the first few checkpoints
          is not eliminated, but its weight in final settlement shrinks
          proportionally.
        </P>
      </Section>
    </>
  )
}

function CliReferenceContent() {
  return (
    <>
      <Section id="name" num="01" heading="Name">
        <P>
          <Code>levx</Code> — command-line interface for the LevX
          path-prediction market protocol.
        </P>
      </Section>

      <Section id="synopsis" num="02" heading="Synopsis">
        <CodeBlock>{`levx <command> [<args>]
levx [--version] [--network <network>] [--wallet <path>]

  COMMANDS
    markets      list, inspect, watch path markets
    paths        list and inspect paths within a market
    wager        place a wager against a path
    positions    inspect or close open positions
    vault        deposit, withdraw, inspect vault shares
    wallet       configure the active keypair
    faucet       request devnet USDC`}</CodeBlock>
      </Section>

      <Section id="description" num="03" heading="Description">
        <P>
          The <Code>levx</Code> command is the primary tool for interacting with
          the protocol from a terminal. It speaks the same RPC endpoints as the
          web app, signs with a local keypair, and prints machine-friendly output
          by default.
        </P>
        <P>
          Every subcommand accepts the global options below. Subcommand-specific
          options follow on the same line.
        </P>
      </Section>

      <Section id="options" num="04" heading="Options">
        <dl className="border-line mt-2 border-b">
          <ManOption flag="--network" arg="network">
            One of <Code>devnet</Code>, <Code>testnet</Code>,{' '}
            <Code>mainnet-beta</Code>. Defaults to the network bound to the
            active wallet, falling back to <Code>devnet</Code>.
          </ManOption>
          <ManOption flag="--wallet" arg="path">
            Path to a Solana keypair JSON file. Overrides the active wallet for
            the duration of the command.
          </ManOption>
          <ManOption flag="--format" arg="format">
            Output format. One of <Code>tsv</Code> (default), <Code>json</Code>,
            or <Code>table</Code>. The Nothing-style <Code>table</Code> renderer
            is intended for human reading only.
          </ManOption>
          <ManOption flag="--rpc" arg="url" required>
            Override the cluster RPC endpoint. Required when{' '}
            <Code>--network</Code> is not one of the named clusters.
          </ManOption>
          <ManOption flag="--no-color">
            Disable ANSI styling. Implied when stdout is not a TTY.
          </ManOption>
        </dl>
      </Section>

      <Section id="examples" num="05" heading="Examples">
        <P>List active BTC markets in human-readable form:</P>
        <CodeBlock>{`levx markets list --pair BTC/USDC --status open --format table`}</CodeBlock>
        <P>Watch a position update on every checkpoint:</P>
        <CodeBlock>{`levx positions watch --market BTC/USDC --path 03`}</CodeBlock>
        <P>Deposit 250 USDC into the vault on devnet:</P>
        <CodeBlock>{`levx vault deposit --amount 250 --network devnet`}</CodeBlock>
      </Section>

      <Section id="see-also" num="06" heading="See also">
        <Ul>
          <Li>
            <Code>@levx/sdk</Code> — TypeScript bindings used internally by the
            CLI.
          </Li>
          <Li>
            <Code>levx-keeper</Code> — the daemon that cranks scoring and
            settlement.
          </Li>
        </Ul>
      </Section>
    </>
  )
}

function DraftingContent({ doc }: { doc: DocId }) {
  const meta = DOC_META[doc]
  return (
    <Section id="overview" num="01" heading="Overview">
      <P>
        <Code>{meta.title}</Code> is being typeset.
      </P>
      <Note kind="tip">
        This page is reserved space — the section is part of the planned
        documentation surface but the canonical text has not yet shipped. Track
        the <Code>{`docs/${doc}.md`}</Code> file in the protocol repository to
        watch the draft land.
      </Note>
      <P>
        In the meantime, the <Code>00 — Getting Started</Code> and{' '}
        <Code>01 — Protocol</Code> rails contain the pages that drove the current
        devnet release.
      </P>
    </Section>
  )
}

export const DOC_RENDERERS: Record<DocId, () => ReactNode> = {
  introduction: IntroductionContent,
  'quick-start': QuickStartContent,
  concepts: ConceptsContent,
  'path-markets': PathMarketsContent,
  'scoring-engine': ScoringEngineContent,
  settlement: () => <DraftingContent doc="settlement" />,
  vault: () => <DraftingContent doc="vault" />,
  cli: CliReferenceContent,
  sdk: () => <DraftingContent doc="sdk" />,
  api: () => <DraftingContent doc="api" />,
  whitepaper: () => <DraftingContent doc="whitepaper" />,
  audit: () => <DraftingContent doc="audit" />,
  changelog: () => <DraftingContent doc="changelog" />,
}
