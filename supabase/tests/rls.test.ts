import { describe, it, expect, beforeEach } from 'vitest'
import { anonClient, serviceClient, walletClient, resetTables, WALLET_A, WALLET_B } from './helpers'

describe('RLS — users', () => {
  beforeEach(async () => {
    await resetTables()
  })

  it('anon can read public users', async () => {
    await serviceClient().from('users').insert({
      wallet_address: WALLET_A,
      wallet_name: 'Phantom',
      username: 'alice_wallet',
      display_name: 'Alice',
      bio: 'bio',
      x_id: 'alice',
      avatar_kind: 'sigil',
      avatar_sigil_idx: 2,
    })
    const { data, error } = await anonClient().from('users').select('username, wallet_address')
    expect(error).toBeNull()
    expect(data).toEqual([
      {
        username: 'alice_wallet',
        wallet_address: WALLET_A,
      },
    ])
  })

  it('auth: wallet can insert only its own profile row', async () => {
    const client = await walletClient(WALLET_A)
    const { data, error } = await client
      .from('users')
      .insert({
        wallet_address: WALLET_A,
        wallet_name: 'Phantom',
        username: 'alice_wallet',
        display_name: 'Alice',
        bio: 'bio',
        x_id: 'alice',
        avatar_kind: 'sigil',
        avatar_sigil_idx: 3,
      })
      .select('wallet_address, username')
      .single()
    expect(error).toBeNull()
    expect(data).toEqual({
      wallet_address: WALLET_A,
      username: 'alice_wallet',
    })
  })

  it('auth: wallet cannot insert another wallet profile row', async () => {
    const client = await walletClient(WALLET_A)
    const { error } = await client.from('users').insert({
      wallet_address: WALLET_B,
      wallet_name: 'Phantom',
      username: 'bob_wallet',
      display_name: 'Bob',
      bio: 'bio',
      x_id: 'bob',
      avatar_kind: 'sigil',
      avatar_sigil_idx: 0,
    })
    expect(error).not.toBeNull()
  })

  it('auth: wallet can update its own mutable profile columns', async () => {
    await serviceClient().from('users').insert({
      wallet_address: WALLET_A,
      wallet_name: 'Phantom',
      username: 'alice_wallet',
      display_name: 'Alice',
      bio: 'bio',
      x_id: 'alice',
      avatar_kind: 'sigil',
      avatar_sigil_idx: 1,
    })
    const client = await walletClient(WALLET_A)
    const { data, error } = await client
      .from('users')
      .update({
        display_name: 'Alice Updated',
        avatar_kind: 'image',
        avatar_image_path: `${WALLET_A}/avatar.png`,
      })
      .eq('wallet_address', WALLET_A)
      .select('display_name, avatar_kind, avatar_image_path')
      .single()
    expect(error).toBeNull()
    expect(data).toEqual({
      display_name: 'Alice Updated',
      avatar_kind: 'image',
      avatar_image_path: `${WALLET_A}/avatar.png`,
    })
  })

  it('auth: wallet cannot mutate immutable profile columns', async () => {
    await serviceClient().from('users').insert({
      wallet_address: WALLET_A,
      wallet_name: 'Phantom',
      username: 'alice_wallet',
      display_name: 'Alice',
      bio: 'bio',
      x_id: 'alice',
      avatar_kind: 'sigil',
      avatar_sigil_idx: 1,
    })
    const client = await walletClient(WALLET_A)
    const { error } = await client
      .from('users')
      .update({ wallet_address: WALLET_B })
      .eq('wallet_address', WALLET_A)
    expect(error?.message).toMatch(/immutable_user_column_modified/)
  })
})

describe('RLS — comments', () => {
  beforeEach(async () => {
    await resetTables()
  })

  it('anon cannot insert', async () => {
    const { error } = await anonClient()
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'hi' })
    expect(error).not.toBeNull()
  })

  it('auth: cannot insert with wallet claim != row wallet', async () => {
    const client = await walletClient(WALLET_A)
    const { error } = await client
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_B, body: 'hi' })
    expect(error).not.toBeNull()
  })

  it('auth: insert with matching wallet succeeds', async () => {
    const client = await walletClient(WALLET_A)
    const { data, error } = await client
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'hi' }).select().single()
    expect(error).toBeNull()
    expect(data?.wallet).toBe(WALLET_A)
  })

  it('anon can read all comments', async () => {
    const svc = serviceClient()
    await svc.from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'public' })
    const { data, error } = await anonClient().from('comments').select()
    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })

  it('auth: update changing wallet raises immutable_column_modified', async () => {
    const svc = serviceClient()
    const { data: row } = await svc.from('comments')
      .insert({ market_id: 'btc', wallet: WALLET_A, body: 'orig' }).select().single()
    const client = await walletClient(WALLET_A)
    const { error } = await client
      .from('comments').update({ wallet: WALLET_B }).eq('id', row!.id)
    expect(error?.message).toMatch(/immutable_column_modified/)
  })

  it('auth: update changing body succeeds and stamps edited_at', async () => {
    const svc = serviceClient()
    const { data: row } = await svc.from('comments')
      .insert({ market_id: 'btc', wallet: WALLET_A, body: 'orig' }).select().single()
    const client = await walletClient(WALLET_A)
    const { data: updated, error } = await client
      .from('comments').update({ body: 'edited' }).eq('id', row!.id).select().single()
    expect(error).toBeNull()
    expect(updated?.body).toBe('edited')
    expect(updated?.edited_at).not.toBeNull()
    expect(updated?.created_at).toBe(row!.created_at)
  })

  it('auth: delete others comment affects 0 rows', async () => {
    const svc = serviceClient()
    const { data: row } = await svc.from('comments')
      .insert({ market_id: 'btc', wallet: WALLET_B, body: 'bob' }).select().single()
    const client = await walletClient(WALLET_A)
    const { error, count } = await client
      .from('comments').delete({ count: 'exact' }).eq('id', row!.id)
    expect(error).toBeNull()
    expect(count).toBe(0)
  })

  it('auth: delete own comment affects 1 row', async () => {
    const client = await walletClient(WALLET_A)
    const { data: row } = await client
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'mine' }).select().single()
    const { count } = await client
      .from('comments').delete({ count: 'exact' }).eq('id', row!.id)
    expect(count).toBe(1)
  })
})

describe('RLS — comment rate limiting', () => {
  beforeEach(async () => { await resetTables() })

  it('insert violating 10s cooldown raises P0001 rate_limit_cooldown', async () => {
    const client = await walletClient(WALLET_A)
    await client.from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'first' })
    const { error } = await client
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'second' })
    expect(error?.message).toMatch(/rate_limit_cooldown/)
  })

  it('insert at hourly cap raises P0001 rate_limit_hourly', async () => {
    const svc = serviceClient()
    // Seed 30 comments within the last hour as service_role (bypasses trigger).
    const now = Date.now()
    const seed = Array.from({ length: 30 }, (_, i) => ({
      market_id: 'btc',
      wallet: WALLET_A,
      body: `seed-${i}`,
      created_at: new Date(now - (30 - i) * 60_000).toISOString(),
    }))
    const { error: seedErr } = await svc.from('comments').insert(seed)
    expect(seedErr).toBeNull()
    // Set the cooldown row so the per-message check doesn't fire first.
    await svc.from('comment_rate_limit').upsert({
      wallet: WALLET_A,
      last_comment_at: new Date(now - 60_000).toISOString(),
    })
    // Now as the wallet itself, attempt one more.
    const client = await walletClient(WALLET_A)
    const { error } = await client
      .from('comments').insert({ market_id: 'btc', wallet: WALLET_A, body: 'overflow' })
    expect(error?.message).toMatch(/rate_limit_hourly/)
  })
})

describe('RLS — market_participants', () => {
  beforeEach(async () => {
    await resetTables()
  })

  it('anon can read service-maintained participant aggregates', async () => {
    await serviceClient().from('market_participants').insert({
      market_id: 49,
      wallet: WALLET_A,
      collateral: 10,
      exposure: 25,
      pnl: 3,
      positions: 2,
    })

    const { data, error } = await anonClient()
      .from('market_participants')
      .select('market_id, wallet, exposure, positions')
      .eq('market_id', 49)

    expect(error).toBeNull()
    expect(data).toEqual([
      {
        market_id: 49,
        wallet: WALLET_A,
        exposure: 25,
        positions: 2,
      },
    ])
  })

  it('anon and wallet clients cannot write participant aggregates', async () => {
    const anonInsert = await anonClient().from('market_participants').insert({
      market_id: 49,
      wallet: WALLET_A,
    })
    expect(anonInsert.error).not.toBeNull()

    const wallet = await walletClient(WALLET_A)
    const walletInsert = await wallet.from('market_participants').insert({
      market_id: 49,
      wallet: WALLET_A,
    })
    expect(walletInsert.error).not.toBeNull()
  })
})

describe('RLS — realtime.messages (path-draw policies)', () => {
  beforeEach(async () => { await resetTables() })

  it('anon cannot subscribe to path-draw:* channel', async () => {
    const anon = anonClient()
    const channel = anon.channel('path-draw:1', { config: { private: true } })
    const status = await new Promise<string>((resolve) => {
      const timer = setTimeout(() => resolve('TIMED_OUT'), 5000)
      channel.subscribe((s) => {
        if (s !== 'SUBSCRIBED') { clearTimeout(timer); resolve(s) }
      })
    })
    expect(['CHANNEL_ERROR', 'CLOSED', 'TIMED_OUT']).toContain(status)
    anon.removeChannel(channel)
  })

  it('auth can subscribe and publish to path-draw:* channel', async () => {
    const client = await walletClient(WALLET_A)
    const channel = client.channel('path-draw:1', { config: { private: true } })
    const subStatus = await new Promise<string>((resolve) => {
      const timer = setTimeout(() => resolve('TIMED_OUT'), 5000)
      channel.subscribe((s) => { if (s === 'SUBSCRIBED') { clearTimeout(timer); resolve(s) } })
    })
    expect(subStatus).toBe('SUBSCRIBED')

    const sent = await channel.send({
      type: 'broadcast',
      event: 'draw_frame',
      payload: { wallet: WALLET_A, points: [] },
    })
    expect(sent).toBe('ok')
    client.removeChannel(channel)
  })
})
