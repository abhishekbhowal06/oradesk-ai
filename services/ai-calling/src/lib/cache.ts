/**
 * Simple in-memory cache with TTL
 */
export class SimpleCache<T> {
    private cache = new Map<string, { value: T; expires: number }>();

    constructor(private ttlMs: number = 60000) { }

    /**
     * Get value from cache
     */
    get(key: string): T | undefined {
        const item = this.cache.get(key);
        if (!item) return undefined;

        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return undefined;
        }

        return item.value;
    }

    /**
     * Set value in cache
     */
    set(key: string, value: T): void {
        this.cache.set(key, {
            value,
            expires: Date.now() + this.ttlMs,
        });
    }

    /**
     * Clear cache
     */
    clear(): void {
        this.cache.clear();
    }
}
