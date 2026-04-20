export interface LeaderboardEntry {
  rank: number
  user: string
  score: number
  accuracy: number
  markets: number
  avatarIdx: number
}

export const LEADERBOARD_DATA: LeaderboardEntry[] = [
  { rank: 1, user: '7K4D···9XQ2', score: 142_580, accuracy: 89.2, markets: 34, avatarIdx: 4 },
  { rank: 2, user: '3mRf···pLw1', score: 128_340, accuracy: 84.7, markets: 28, avatarIdx: 6 },
  { rank: 3, user: 'Bx9T···kZn4', score: 115_920, accuracy: 81.3, markets: 31, avatarIdx: 1 },
  { rank: 4, user: 'Qw2P···vHm8', score: 98_450, accuracy: 77.1, markets: 25, avatarIdx: 0 },
  { rank: 5, user: 'Nt5L···jRs6', score: 87_200, accuracy: 74.5, markets: 22, avatarIdx: 2 },
  { rank: 6, user: 'Yh8K···cFd3', score: 76_890, accuracy: 71.9, markets: 20, avatarIdx: 3 },
  { rank: 7, user: 'Wm1X···bGv7', score: 65_430, accuracy: 68.2, markets: 18, avatarIdx: 5 },
  { rank: 8, user: 'Zv4C···xTn2', score: 54_120, accuracy: 65.8, markets: 15, avatarIdx: 7 },
  { rank: 9, user: 'Dp6S···aUq9', score: 48_750, accuracy: 63.1, markets: 14, avatarIdx: 8 },
  { rank: 10, user: 'Fj3R···eYh5', score: 42_300, accuracy: 60.4, markets: 12, avatarIdx: 0 },
]
