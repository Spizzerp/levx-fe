export type ProviderStatus = 'sandbox' | 'curated' | 'suspended' | string

export interface ProviderGatewayStatus {
  enabled: boolean
  admin_enabled: boolean
  storage_backend: string | null
  filesystem_durable: boolean | null
  artifact_bucket: string | null
  external_provider_ready: boolean
  forecast_rate_limit_per_minute: number
}

export interface PipelineStatus {
  status: string
  dry_run_submission: boolean
  scheduler_running: boolean
  markets_generated: number
  cleanup_endpoint_enabled: boolean
  provider_gateway: ProviderGatewayStatus
}

export interface ProviderRecord {
  schema_version: number
  provider_id: string
  display_name: string
  provider_type: string
  status: ProviderStatus
  created_at: string
  updated_at: string
  submission_stats?: ProviderSubmissionStats
  status_history?: Array<{
    status: ProviderStatus
    actor: string
    at: string
    reason: string
  }>
}

export interface ProvidersResponse {
  providers: ProviderRecord[]
}

export interface ProviderSeasonMetadata {
  season_key: string
  season_id?: string | null
  asset_season_address?: string | null
  parent_status?: string | null
  group_key_hash?: string | null
  group_kind?: string | null
  parent_group?: string | null
  pair: string
  product_season: string
  horizon: string
  timeframe_seconds: number
  start_time: number
  end_time: number
  display_name?: string | null
  description?: string | null
}

export interface ProviderMarketContext {
  market_id: number
  season_key: string
  season_id?: string | null
  season?: ProviderSeasonMetadata | null
  group_key_hash?: string | null
  group_kind?: string | null
  parent_group?: string | null
  pair: string
  start_time: number
  end_time: number
  checkpoint_interval: number
  timeframe_seconds: number
  checkpoint_timestamps: number[]
  price_scale: number
  target_num_paths: number
  submission_deadline: number
  pyth_feed_id: string
}

export interface OpenProviderMarketsResponse {
  markets: ProviderMarketContext[]
}

export interface ProviderMarketContextsResponse {
  markets: ProviderMarketContext[]
}

export interface ProviderAttribution {
  provider_id: string
  selection_run_id: string
  submission_id: string
  provider_path_hash: string
  market_id: number
  season_key?: string
  pair?: string
  menu_path_index: number
  onchain_path_index: number
  submission_status: string
  tx_signature?: string | null
  created_at?: string
}

export interface ProviderSubmissionStats {
  submissions_submitted: number
  submissions_valid: number
  paths_submitted: number
  paths_valid: number
  paths_selected: number
}

export interface OrthogonalPrecisionResult {
  score_id: string
  score_run_id: string
  provider_id: string
  submission_id: string
  provider_path_hash: string
  market_id: number
  pair?: string
  season_key?: string
  path_sequence: number
  selected: boolean
  menu_path_index?: number | null
  onchain_path_index?: number | null
  composite_score: number
  calibration_error: number
  consensus_distance: number
  non_redundancy: number
  orthogonal_contribution: number
  leave_one_out_delta: number
  crowding_score: number
  scorer_version: string
  created_at: string
}

export interface ReputationSnapshot {
  provider_id: string
  window_days: number
  scorer_version: string
  markets_submitted: number
  paths_submitted: number
  paths_valid: number
  paths_selected: number
  avg_composite_score: number
  median_composite_score: number
  top_decile_rate: number
  selection_rate: number
  redundancy_rate: number
  orthogonal_contribution: number
  calibration_error: number
  updated_at: string
}

export interface ProviderResultsResponse {
  provider_id: string
  status: ProviderStatus
  submission_stats?: ProviderSubmissionStats
  selected_paths: ProviderAttribution[]
  results: OrthogonalPrecisionResult[]
  reputation_snapshots: ReputationSnapshot[]
}

export interface ProviderLeaderboardResponse {
  leaderboard: ReputationSnapshot[]
  filters: {
    pair: string | null
    horizon: string | null
    season_key: string | null
    selected_only: boolean
    window_days: number
  }
}
