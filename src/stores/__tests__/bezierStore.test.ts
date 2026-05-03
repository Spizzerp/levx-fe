import { describe, it, expect, beforeEach } from 'vitest'

import { useBezierStore } from '@/stores/bezierStore'
import type { BezierAnchor } from '@/lib/drawing/bezierSampling'

const corner = (x: number, y: number): BezierAnchor => ({
  domainX: x,
  domainY: y,
  outHandle: null,
})

beforeEach(() => {
  useBezierStore.setState({ anchors: [], past: [], future: [] })
})

describe('bezierStore', () => {
  it('starts empty', () => {
    const s = useBezierStore.getState()
    expect(s.anchors).toEqual([])
    expect(s.past).toEqual([])
    expect(s.future).toEqual([])
  })

  it('setAnchors does not push history (transient drag updates)', () => {
    const a = [corner(0, 0)]
    useBezierStore.getState().setAnchors(a)
    const s = useBezierStore.getState()
    expect(s.anchors).toEqual(a)
    expect(s.past).toEqual([])
  })

  it('pushEdit records before/after and clears future', () => {
    const a = [corner(0, 0)]
    const b = [corner(0, 0), corner(10, 10)]
    useBezierStore.setState({ future: [{ kind: 'edit', before: [], after: [] }] })
    useBezierStore.getState().pushEdit(a, b)
    const s = useBezierStore.getState()
    expect(s.anchors).toEqual(b)
    expect(s.past).toEqual([{ kind: 'edit', before: a, after: b }])
    expect(s.future).toEqual([]) // cleared
  })

  it('pushCommit clears anchors and records pre-commit state', () => {
    const pre = [corner(0, 0), corner(10, 10)]
    useBezierStore.getState().pushCommit(pre)
    const s = useBezierStore.getState()
    expect(s.anchors).toEqual([])
    expect(s.past).toEqual([{ kind: 'commit', before: pre }])
  })

  it('undo restores `before` for an edit and pushes onto future', () => {
    const a = [corner(0, 0)]
    const b = [corner(0, 0), corner(10, 10)]
    useBezierStore.getState().pushEdit(a, b)

    const action = useBezierStore.getState().undo()
    expect(action?.kind).toBe('edit')
    const s = useBezierStore.getState()
    expect(s.anchors).toEqual(a)
    expect(s.past).toEqual([])
    expect(s.future).toEqual([{ kind: 'edit', before: a, after: b }])
  })

  it('undo on a commit returns kind=commit and restores pre-commit anchors', () => {
    const pre = [corner(0, 0), corner(10, 10)]
    useBezierStore.getState().pushCommit(pre)
    const action = useBezierStore.getState().undo()
    expect(action?.kind).toBe('commit')
    const s = useBezierStore.getState()
    expect(s.anchors).toEqual(pre)
  })

  it('redo on an edit applies `after` and re-pushes onto past', () => {
    const a = [corner(0, 0)]
    const b = [corner(0, 0), corner(10, 10)]
    useBezierStore.getState().pushEdit(a, b)
    useBezierStore.getState().undo()
    const action = useBezierStore.getState().redo()
    expect(action?.kind).toBe('edit')
    const s = useBezierStore.getState()
    expect(s.anchors).toEqual(b)
    expect(s.future).toEqual([])
  })

  it('redo on a commit clears anchors again', () => {
    const pre = [corner(0, 0), corner(10, 10)]
    useBezierStore.getState().pushCommit(pre)
    useBezierStore.getState().undo()
    expect(useBezierStore.getState().anchors).toEqual(pre)
    const action = useBezierStore.getState().redo()
    expect(action?.kind).toBe('commit')
    expect(useBezierStore.getState().anchors).toEqual([])
  })

  it('undo when past is empty is a noop and returns null', () => {
    const action = useBezierStore.getState().undo()
    expect(action).toBeNull()
  })

  it('redo when future is empty is a noop and returns null', () => {
    const action = useBezierStore.getState().redo()
    expect(action).toBeNull()
  })

  it('reset wipes all state', () => {
    const a = [corner(0, 0)]
    useBezierStore.getState().pushEdit([], a)
    useBezierStore.getState().reset()
    const s = useBezierStore.getState()
    expect(s.anchors).toEqual([])
    expect(s.past).toEqual([])
    expect(s.future).toEqual([])
  })

  it('round-trip: place, undo, redo lands back on the same state', () => {
    const a = [corner(0, 0)]
    const b = [corner(0, 0), corner(10, 10)]
    const c = [corner(0, 0), corner(10, 10), corner(20, 20)]
    useBezierStore.getState().pushEdit([], a)
    useBezierStore.getState().pushEdit(a, b)
    useBezierStore.getState().pushEdit(b, c)

    useBezierStore.getState().undo()
    useBezierStore.getState().undo()
    expect(useBezierStore.getState().anchors).toEqual(a)
    useBezierStore.getState().redo()
    useBezierStore.getState().redo()
    expect(useBezierStore.getState().anchors).toEqual(c)
  })

  it('a new edit after undo clears the future (branching)', () => {
    const a = [corner(0, 0)]
    const b = [corner(0, 0), corner(10, 10)]
    useBezierStore.getState().pushEdit([], a)
    useBezierStore.getState().pushEdit(a, b)
    useBezierStore.getState().undo()
    expect(useBezierStore.getState().future).toHaveLength(1)
    // Branching edit
    useBezierStore.getState().pushEdit(a, [corner(99, 99)])
    expect(useBezierStore.getState().future).toEqual([])
  })
})
