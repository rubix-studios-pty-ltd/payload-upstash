# PayloadCMS + Upstash KV Adapter

This package provides a way to use [Upstash](https://upstash.com) as a KV adapter with Payload.

## Installation

```sh
pnpm add @rubixstudios/payload-upstash
```

## Usage

```ts
import { upstashKVAdapter } from '@rubixstudios/payload-upstash'

export default buildConfig({
  collections: [Media],
  kv: upstashKVAdapter({
    // Upstash connection URL. Defaults to process.env.UPSTASH_URL
    url: process.env.UPSTASH_URL!,
    token: process.env.UPSTASH_TOKEN!,
    // Optional prefix for Upstash Redis keys to isolate the store. Defaults to 'payload-kv:'
    keyPrefix: 'kv-storage:',
  }),
})
```

Then you can access the KV storage using `payload.kv`:

```ts
await payload.kv.set('key', { value: 1 })
const data = await payload.kv.get('key')
payload.logger.info(data)
```
