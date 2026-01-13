import { type KVAdapter, type KVAdapterResult, type KVStoreValue } from 'payload'
import { Redis } from '@upstash/redis'

export class UpstashKVAdapter implements KVAdapter {
  private redis: Redis
  private prefix: string

  constructor(keyPrefix: string, redis: Redis) {
    this.redis = redis
    this.prefix = keyPrefix
  }

  private key(key: string) {
    return `${this.prefix}${key}`
  }

  async get<T extends KVStoreValue>(key: string): Promise<T | null> {
    const raw = await this.redis.get(this.key(key))
    if (!raw) return null
    if (typeof raw === 'string') {
        return JSON.parse(raw) as T
    }
    return raw as T
  }

  async set(key: string, data: KVStoreValue): Promise<void> {
    await this.redis.set(this.key(key), JSON.stringify(data))
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.key(key))
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(this.key(key))
    return exists === 1
  }

  /**
   * Not supported in Upstash (no KEYS command)
   */
  async keys(): Promise<string[]> {
    throw new Error('keys() is not supported by Upstash Redis')
  }

  /**
   * Safe clear strategy: rotate prefix
   * Payload rarely calls this in production
   */
  async clear(): Promise<void> {
    throw new Error('clear() is not supported by Upstash Redis')
  }
}

export type UpstashKVAdapterOptions = {
  keyPrefix?: string
  url?: string
  token?: string
}

export const upstashKVAdapter = (
  options: UpstashKVAdapterOptions = {}
): KVAdapterResult => {
  const redis = new Redis({
    url: options.url ?? process.env.UPSTASH_URL!,
    token: options.token ?? process.env.UPSTASH_TOKEN!,
  })

  const keyPrefix = options.keyPrefix ?? 'payload-kv:'

  return {
    init: () => new UpstashKVAdapter(keyPrefix, redis),
  }
}
