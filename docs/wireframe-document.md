# LevX PC Web Application — Wireframe Document

## 1. Overview

This document defines the desktop (PC) web wireframe for the LevX protocol application. There is currently no existing design system or design documentation, so this serves as the foundational UX structure.

The primary goal of the product is to allow users to explore prediction markets, select or create price paths, and place wagers.

### Core Principle
The landing/dashboard experience must prioritize **market discovery**. Users should immediately see a list of markets they can enter.

---

## 2. Global Layout (Desktop)

### Structure
- Top Navigation Bar
- Main Content Area

### Top Navigation (Updated)
- Markets (default landing)
- Positions
- Vault
- Portfolio
- Leaderboard
- Wallet Connection

---

## 3. Dashboard (Landing Page — Primary Entry)

### Entry Behavior
Users land directly on the **Dashboard (Markets view)**.

### Purpose
- Immediate market discovery
- Quick entry into active markets
- Lightweight protocol awareness via stats

---

### 3.1 Top Stats Bar (Centered Above Markets)

Displayed prominently at the top center.

#### Stats (3 Key Metrics)
- **Total Traders** (e.g., 12,482)
- **Total Volume Traded** (e.g., $84.2M)
- **Active Markets** *(recommended third stat)*
  - Alternative options:
    - Total Value Locked (TVL)
    - Total Open Interest

#### Layout
Centered horizontal strip:

[ Traders ]   [ Volume ]   [ Active Markets ]

---

### 3.2 Market Tabs

Below stats, users can toggle between market states.

- **Open Markets (Default)**
- **Closed Markets**

Optional future:
- Upcoming / Pending

---

### 3.3 Market List (Core Component)

Displayed as a vertical list or responsive grid.

### Market Card Structure
Each card includes:
- Token pair (e.g., SOL/USDC)
- Market duration
- Market state (Active / Sampling / Settling / etc.)
- Total pool size (USDC)
- Number of paths
- Checkpoint progress (e.g., 12/24)
- Progress bar (timeline)
- CTA: **Enter Market**

### Interaction
- Clicking a card → navigates to Market Detail page

---

## 4. Market Detail Page (Core Experience)

### Purpose
Primary interaction surface where users analyze paths and place wagers.

### Layout Sections

#### 4.1 Market Header
- Token pair
- Remaining time
- Total pool size
- Market status

#### 4.2 Chart Area (Primary Focus)
- Real price line (oracle data)
- AI-generated paths (5 default)
- User-drawn paths (if any)

This is the dominant visual (~70% width).

#### 4.3 Paths Panel (Right Side)
- Path name (e.g., "Steady Bull")
- Implied probability
- Mini preview
- Select button

Additional:
- **Draw Custom Path**

#### 4.4 Trade Panel
- Selected path
- Input: Amount (USDC)
- Leverage selector (disabled in Mode 1)
- Estimated shares
- Fees
- CTA: **Place Wager**

---

## 5. Path Creation Interface

### Purpose
Allow users to create custom prediction paths.

### Behavior
- Modal or full-screen overlay

### Features
- Interactive chart canvas
- Control points (click + drag)
- Auto-smoothed curve
- Checkpoint preview

### Actions
- Reset
- Confirm Path

---

## 6. Positions Page

### Purpose
Track **currently active positions only** (live exposure).

### Content
- Active positions list
- Real-time score updates
- Health factor (Mode 2)
- Close position action

---

## 7. Portfolio Page

### Purpose
Historical + financial overview

### Sections

#### 7.1 Settled Positions
- Final payout
- Claim button

#### 7.2 Performance Summary
- Total PnL
- Win rate
- Historical accuracy

---

## 8. Leaderboard

### Purpose
Display rankings and incentivize participation.

### Table
- Rank
- User
- Score
- Accuracy
- Markets participated

---

## 9. Vault Page (Mode 2)

### Purpose
Liquidity provider interface

### Sections

#### Overview
- TVL
- Utilization
- APR

#### Actions
- Deposit (USDC → levUSD)
- Withdraw (levUSD → USDC)

#### Stats
- Borrowed
- Fees earned
- Exchange rate

---

## 10. Market States (UI Mapping)

- Pending → Waiting for activation
- Active → Trading open
- Sampling → Price tracking
- Settling → Calculating results
- Maturing → Verification window
- Settled → Claim available
- Void → Refunded

---

## 11. Core Components

### Buttons
- Primary: Place Wager
- Secondary: Draw Path
- Tertiary: Enter Market

### Cards
- Market Card
- Position Card
- Path Card

### Data Visualization
- Price chart with path overlays
- Progress indicators
- Score indicators

---

## 12. Key User Flows

### Enter Market
Dashboard → Select market → View → Choose path → Enter amount → Place wager

### Draw Path
Market → Draw → Adjust → Confirm → Wager

### Claim
Portfolio → Settled → Claim

### Provide Liquidity
Vault → Deposit → Earn yield

---

## 13. UX Priorities

- Dashboard must immediately show **enterable markets**
- Open markets are default view
- Stats provide quick protocol credibility
- Chart is central interaction surface
- Paths must be clearly distinguishable
- Risk (leverage) must be visible

---

## 14. Notes

- Desktop-first
- Mobile is secondary (limited path drawing)
- No dependency on centralized backend for core actions

---

End of Document

