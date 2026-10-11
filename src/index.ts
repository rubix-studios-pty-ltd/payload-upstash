import { type KVAdapter, type KVAdapterResult, type KVStoreValue } from 'payload'
import { Redis } from '@upstash/redis'

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

  private resolveTTL?: (key: string) => number | undefined

  constructor(keyPrefix: string, redis: Redis, ttlConfig?: TTLConfig) {
    if (!keyPrefix) {
      throw new Error('A Redis key prefix is required')
    }

    this.redis = redis
    this.prefix = keyPrefix

    if (ttlConfig) {
      this.resolveTTL = (key: string) => {
        for (const rule of ttlConfig) {
          if (key.startsWith(rule.prefix)) {
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

  private async scan(): Promise<string[]> {
    const keys = new Set<string>()
    let cursor = '0'

    do {
      const [next, results] = await this.redis.scan(cursor, {
        match: `${this.prefix}*`,
        count: 1000,
      })

      for (const key of results) {
        if (key.startsWith(this.prefix)) {
          keys.add(key)
        }
      }

      cursor = next
    } while (cursor !== '0')

    return [...keys]
  }

  async clear(): Promise<void> {
    const keys = await this.scan()

    for (let index = 0; index < keys.length; index += 100) {
      await this.redis.del(...keys.slice(index, index + 100))
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.key(key))
  }

  async get<T extends KVStoreValue>(key: string): Promise<null | T> {
    const value = await this.redis.get<T>(this.key(key))
    return value ?? null
  }

  async getdel<T extends KVStoreValue>(key: string): Promise<null | T> {
    const value = await this.redis.getdel<T>(this.key(key))
    return value ?? null
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(this.key(key))
    return exists === 1
  }

  async keys(): Promise<string[]> {
    const keys = await this.scan()
    return keys.map((key) => key.slice(this.prefix.length))
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
    const ttl = this.resolveTTL?.(key)

    if (ttl !== undefined && ttl > 0) {
      if (!Number.isSafeInteger(ttl)) {
        throw new Error(`Invalid Redis TTL for key "${key}"`)
      }

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
  const token = options.token ?? process.env.UPSTASH_TOKEN
  const url = options.url ?? process.env.UPSTASH_URL

  if (!token || !url) {
    throw new Error('Upstash Redis URL and token are required')
  }

  const redis = new Redis({ token, url })
  const keyPrefix = options.keyPrefix ?? 'payload-kv:'

  return {
    init: () => new UpstashKVAdapter(keyPrefix, redis, options.ttl),
  }
}
