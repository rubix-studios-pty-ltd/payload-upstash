import { Redis } from '@upstash/redis'
import { type KVAdapter, type KVAdapterResult, type KVStoreValue } from 'payload'

/**
 * Rule used to determine the time-to-live (TTL) for keys matching a prefix.
 */
export type TTLRule = {
  /**
   * Key prefix this rule applies to (matched via {@link String.startsWith}).
   */
  prefix: string
  /**
   * Time-to-live in seconds, passed directly to Redis as the `ex` option.
   *
   * Expected to be a positive integer. If this value is `undefined`, `0`,
   * or negative, no expiration will be set for matching keys.
   */
  ttl: number
}

/**
 * Collection of TTL rules evaluated in order to resolve per-key expiration.
 */
export type TTLConfig = TTLRule[]

export class UpstashKVAdapter implements KVAdapter {
  private prefix: string
  private redis: Redis
  private resolveTTL?: (upstashKey: string) => number | undefined

  constructor(keyPrefix: string, redis: Redis, ttlConfig?: TTLConfig) {
    this.redis = redis
    this.prefix = keyPrefix

    if (ttlConfig) {
      this.resolveTTL = (upstashKey: string) => {
        for (const rule of ttlConfig) {
          if (upstashKey.startsWith(rule.prefix)) {
            return rule.ttl
          }
        }
        return undefined
      }
    }
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
    const value = await this.redis.get<T>(this.key(key))
    return value ?? null
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

  async mget<T extends KVStoreValue>(keys: readonly string[]): Promise<Array<null | T>> {
    if (keys.length === 0) {
      return []
    }

    const values = await this.redis.mget<T[]>(keys.map((key) => this.key(key)))

    return values.map((value) => value ?? null)
  }

  async set(key: string, data: KVStoreValue): Promise<void> {
    const upstashKey = this.key(key)
    const ttl = this.resolveTTL?.(upstashKey)

    if (ttl && ttl > 0) {
      await this.redis.set(upstashKey, data, { ex: ttl })
    } else {
      await this.redis.set(upstashKey, data)
    }
  }
}

export type UpstashKVAdapterOptions = {
  /**
   * Optional prefix for Redis keys
   *
   * @default 'payload-kv:'
   */
  keyPrefix?: string

  /**
   * Upstash REST token
   */
  token?: string

  /**
   * Optional TTL configuration
   */
  ttl?: TTLConfig

  /**
   * Upstash REST URL
   */
  url?: string
}

export const upstashKVAdapter = (options: UpstashKVAdapterOptions = {}): KVAdapterResult => {
  const redis = new Redis({
    token: options.token ?? process.env.UPSTASH_TOKEN!,
    url: options.url ?? process.env.UPSTASH_URL!,
  })

  const keyPrefix = options.keyPrefix ?? 'payload-kv:'

  return {
    init: () => new UpstashKVAdapter(keyPrefix, redis, options.ttl),
  }
}
