# PayloadCMS + Upstash KV Adapter

This package provides a way to use [Upstash](https://upstash.com) as a KV adapter with Payload.

## Compatibility

This plugin supports both Payload CMS v3 and v4 through a single release line.

| Payload CMS | Release branch | npm dist-tag |
| --- | --- | --- |
| v4 | `main` | `latest` |
| v3 | `main` | `latest` |

Both versions are supported by the same package release. No separate branches or version-specific installations are required.

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
    // Optional TTL configuration for automatic expiration by key prefix
    ttl: [
      { prefix: 'session:', ttl: 3600 },
      { prefix: 'cache:', ttl: 300 },
      { prefix: 'temp:', ttl: 60 },
    ],
  }),
})
```

Then you can access the KV storage using `payload.kv`:

```ts
await payload.kv.set('key', { value: 1 })
const data = await payload.kv.get('key')
payload.logger.info(data)
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support or inquiries:

- LinkedIn: [rubixvi](https://www.linkedin.com/in/rubixvi/)
- Website: [Rubix Studios](https://rubixstudios.com.au)

## Author

Rubix Studios  
[https://rubixstudios.com.au](https://rubixstudios.com.au)
