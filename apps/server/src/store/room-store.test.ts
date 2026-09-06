import { describe, expect, it, beforeEach } from 'vitest'
import { createRoomStore, type RoomStore } from './room-store'

describe('房间管理', () => {
  let store: RoomStore

  beforeEach(() => {
    store = createRoomStore()
  })

  it('创建房间返回 6 位房间码，创建者为座位 0', () => {
    const code = store.createRoom('host', 'guobiao')
    expect(code).toHaveLength(6)
    const members = store.getRoomMembers(code)
    expect(members).toHaveLength(1)
    expect(members[0].seat).toBe(0)
    expect(members[0].ready).toBe(false)
  })

  it('加入房间按顺序分配座位', () => {
    const code = store.createRoom('host', 'guobiao')
    store.joinRoom(code, 'p1')
    store.joinRoom(code, 'p2')
    store.joinRoom(code, 'p3')
    const members = store.getRoomMembers(code)
    expect(members).toHaveLength(4)
    expect(members.map((m) => m.seat)).toEqual([0, 1, 2, 3])
  })

  it('房间满 4 人后拒绝加入', () => {
    const code = store.createRoom('host', 'guobiao')
    store.joinRoom(code, 'p1')
    store.joinRoom(code, 'p2')
    store.joinRoom(code, 'p3')
    const err = store.joinRoom(code, 'p4')
    expect(err).toBe('房间已满')
  })

  it('加入不存在的房间返回错误', () => {
    expect(store.joinRoom('XXXXXX', 'p1')).toBe('房间不存在')
  })

  it('重复加入返回错误', () => {
    const code = store.createRoom('host', 'guobiao')
    expect(store.joinRoom(code, 'host')).toBe('已在房间中')
  })

  it('准备状态设置成功', () => {
    const code = store.createRoom('host', 'guobiao')
    store.setReady(code, 'host')
    const members = store.getRoomMembers(code)
    expect(members[0].ready).toBe(true)
  })

  it('非房主不可开局', () => {
    const code = store.createRoom('host', 'guobiao')
    store.joinRoom(code, 'p1')
    store.joinRoom(code, 'p2')
    store.joinRoom(code, 'p3')
    store.setReady(code, 'host')
    store.setReady(code, 'p1')
    store.setReady(code, 'p2')
    store.setReady(code, 'p3')
    expect(store.startGame(code, 'p1')).toBe('只有房主可以开局')
  })

  it('未全员准备不可开局', () => {
    const code = store.createRoom('host', 'guobiao')
    store.joinRoom(code, 'p1')
    store.joinRoom(code, 'p2')
    store.joinRoom(code, 'p3')
    expect(store.startGame(code, 'host')).toBe('有玩家未准备')
  })

  it('全员准备后房主可开局', () => {
    const code = store.createRoom('host', 'guobiao')
    store.joinRoom(code, 'p1')
    store.joinRoom(code, 'p2')
    store.joinRoom(code, 'p3')
    store.setReady(code, 'host')
    store.setReady(code, 'p1')
    store.setReady(code, 'p2')
    store.setReady(code, 'p3')
    expect(store.startGame(code, 'host')).toBeNull()
    expect(store.getRoom(code)?.started).toBe(true)
  })

  it('对局已开始后不可加入', () => {
    const code = store.createRoom('host', 'guobiao')
    store.joinRoom(code, 'p1')
    store.joinRoom(code, 'p2')
    store.joinRoom(code, 'p3')
    store.setReady(code, 'host')
    store.setReady(code, 'p1')
    store.setReady(code, 'p2')
    store.setReady(code, 'p3')
    store.startGame(code, 'host')
    expect(store.joinRoom(code, 'p4')).toBe('对局已开始')
  })

  it('根据 socketId 查找房间', () => {
    const code = store.createRoom('host', 'guobiao')
    expect(store.findRoomBySocket('host')?.code).toBe(code)
    expect(store.findRoomBySocket('nobody')).toBeUndefined()
  })

  it('获取座位号', () => {
    const code = store.createRoom('host', 'guobiao')
    store.joinRoom(code, 'p1')
    expect(store.getSeat(code, 'host')).toBe(0)
    expect(store.getSeat(code, 'p1')).toBe(1)
    expect(store.getSeat(code, 'nobody')).toBeNull()
  })

  it('开局前全员离开后房间被清理，房间码失效', () => {
    const code = store.createRoom('host', 'guobiao')
    store.joinRoom(code, 'p1')
    store.leaveRoom(code, 'host')
    store.leaveRoom(code, 'p1')
    expect(store.getRoom(code)).toBeUndefined()
    expect(store.joinRoom(code, 'p3')).toBe('房间不存在')
  })

  it('开局前仍有成员时离开不清理房间', () => {
    const code = store.createRoom('host', 'guobiao')
    store.joinRoom(code, 'p1')
    store.leaveRoom(code, 'host')
    expect(store.getRoom(code)).toBeDefined()
  })

  it('已开局房间成员离开不清理', () => {
    const code = store.createRoom('host', 'guobiao')
    store.joinRoom(code, 'p1')
    store.joinRoom(code, 'p2')
    store.joinRoom(code, 'p3')
    store.setReady(code, 'host')
    store.setReady(code, 'p1')
    store.setReady(code, 'p2')
    store.setReady(code, 'p3')
    store.startGame(code, 'host')
    store.leaveRoom(code, 'host')
    expect(store.getRoom(code)?.started).toBe(true)
    expect(store.getRoom(code)).toBeDefined()
  })
})
