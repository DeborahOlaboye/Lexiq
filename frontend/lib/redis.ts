import Redis from "ioredis";

let _client: Redis | null = null;

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!_client) {
    _client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
    _client.on("error", (e) => console.error("[redis]", e.message));
  }
  return _client;
}
