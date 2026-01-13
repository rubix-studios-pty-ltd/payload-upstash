import { Redis } from '@upstash/redis'
import { type KVAdapter, type KVAdapterResult, type KVStoreValue } from 'payload'

export class UpstashKVAdapter implements KVAdapter {
  private prefix: string
  private redis: Redis

  constructor(keyPrefix: string, redis: Redis) {
    this.redis = redis
    this.prefix = keyPrefix
  }

  private key(key: string) {
    return `${this.prefix}${key}`
  }

  /**
   * Safe clear strategy: rotate prefix
   * Payload rarely calls this in production
   */
  clear(): Promise<void> {
    throw new Error('clear() is not supported by Upstash Redis')
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.key(key))
  }

  async get<T extends KVStoreValue>(key: string): Promise<null | T> {
    const raw = await this.redis.get<T>(this.key(key))
    if (!raw) {return null}
    return raw
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(this.key(key))
    return exists === 1
  }

  /**
   * Not supported in Upstash (no KEYS command)
   */
  keys(): Promise<string[]> {
    throw new Error('keys() is not supported by Upstash Redis')
  }

  async set(key: string, data: KVStoreValue): Promise<void> {
    await this.redis.set(this.key(key), data)
  }
}

export type UpstashKVAdapterOptions = {
  keyPrefix?: string
  token?: string
  url?: string
}

export const upstashKVAdapter = (options: UpstashKVAdapterOptions = {}): KVAdapterResult => {
  const redis = new Redis({
    token: options.token ?? process.env.UPSTASH_TOKEN!,
    url: options.url ?? process.env.UPSTASH_URL!,
  })

  const keyPrefix = options.keyPrefix ?? 'payload-kv:'

  return {
    init: () => new UpstashKVAdapter(keyPrefix, redis),
  }
}
