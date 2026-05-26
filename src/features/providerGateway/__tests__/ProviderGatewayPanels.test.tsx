import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  ProviderResultsPanel,
  ProviderTable,
} from '@/features/providerGateway/ProviderGatewayPanels'
import type { ProviderRecord, ProviderResultsResponse } from '@/features/providerGateway/types'

describe('ProviderTable', () => {
  it('uses live submission stats before orthogonal precision snapshots exist', () => {
    const provider = {
      schema_version: 1,
      provider_id: 'prov_aaaaaaaaaaaaaaaaaaaaaaaa',
      display_name: 'Quant Fund A',
      provider_type: 'quant_fund',
      status: 'sandbox',
      created_at: '2026-05-20T10:00:00Z',
      updated_at: '2026-05-20T11:00:00Z',
      submission_stats: {
        submissions_submitted: 1,
        submissions_valid: 1,
        paths_submitted: 3,
        paths_valid: 3,
        paths_selected: 1,
      },
    } as ProviderRecord

    render(
      <ProviderTable
        providers={[provider]}
        snapshots={[]}
        providerById={new Map([[provider.provider_id, provider]])}
      />,
    )

    const row = screen.getByRole('row', { name: /Quant Fund A/ })
    const cells = within(row).getAllByRole('cell')
    expect(cells[2]).toHaveTextContent('3')
    expect(cells[3]).toHaveTextContent('1')
  })

  it('uses live submission stats in provider detail metrics before scores exist', () => {
    const provider = {
      schema_version: 1,
      provider_id: 'prov_aaaaaaaaaaaaaaaaaaaaaaaa',
      display_name: 'Quant Fund A',
      provider_type: 'quant_fund',
      status: 'sandbox',
      created_at: '2026-05-20T10:00:00Z',
      updated_at: '2026-05-20T11:00:00Z',
    } as ProviderRecord
    const results = {
      provider_id: provider.provider_id,
      status: provider.status,
      submission_stats: {
        submissions_submitted: 1,
        submissions_valid: 1,
        paths_submitted: 3,
        paths_valid: 3,
        paths_selected: 1,
      },
      selected_paths: [],
      results: [],
      reputation_snapshots: [],
    } as ProviderResultsResponse

    render(<ProviderResultsPanel provider={provider} results={results} />)

    const validMetric = screen.getByText('Valid paths').closest('div')
    const selectedMetric = screen.getByText('Selected').closest('div')
    if (!validMetric || !selectedMetric) {
      throw new Error('Expected provider metric panels to render')
    }
    expect(validMetric).toHaveTextContent('3')
    expect(selectedMetric).toHaveTextContent('1')
  })
})
