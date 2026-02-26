/**
 * Circuit Breaker Unit Tests
 *
 * Tests for circuit breaker pattern implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '../lib/circuit-breaker';

describe('Circuit Breaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenRequests: 2,
    });
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed');
    });

    it('should have zero failure count', () => {
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('closed state behavior', () => {
    it('should allow requests through when closed', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should track successful calls', async () => {
      await breaker.execute(async () => 'ok');
      await breaker.execute(async () => 'ok');

      const stats = breaker.getStats();
      expect(stats.successCount).toBe(2);
    });

    it('should track failed calls', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {}

      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(1);
    });
  });

  describe('opening circuit', () => {
    it('should open after reaching failure threshold', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      expect(breaker.getState()).toBe('open');
    });

    it('should reject requests when open', async () => {
      // Trigger opening
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      await expect(breaker.execute(async () => 'test')).rejects.toThrow(CircuitOpenError);
    });

    it('should include circuit name in error', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      try {
        await breaker.execute(async () => 'test');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        expect((error as CircuitOpenError).circuitName).toBe('test-breaker');
      }
    });
  });

  describe('half-open state', () => {
    it('should transition to half-open after timeout', async () => {
      vi.useFakeTimers();

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      expect(breaker.getState()).toBe('open');

      // Advance time past reset timeout
      vi.advanceTimersByTime(1100);

      expect(breaker.getState()).toBe('half-open');

      vi.useRealTimers();
    });
  });

  describe('recovery', () => {
    it('should close after successful half-open requests', async () => {
      vi.useFakeTimers();

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      // Transition to half-open
      vi.advanceTimersByTime(1100);
      expect(breaker.getState()).toBe('half-open');

      // Successful requests in half-open
      await breaker.execute(async () => 'ok');
      await breaker.execute(async () => 'ok');

      expect(breaker.getState()).toBe('closed');

      vi.useRealTimers();
    });

    it('should reopen if request fails in half-open', async () => {
      vi.useFakeTimers();

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      // Transition to half-open
      vi.advanceTimersByTime(1100);
      expect(breaker.getState()).toBe('half-open');

      // Failed request in half-open
      try {
        await breaker.execute(async () => {
          throw new Error('fail again');
        });
      } catch {}

      expect(breaker.getState()).toBe('open');

      vi.useRealTimers();
    });
  });

  describe('manual reset', () => {
    it('should reset all counters', async () => {
      // Generate some activity
      await breaker.execute(async () => 'ok');
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {}

      breaker.reset();

      const stats = breaker.getStats();
      expect(stats.state).toBe('closed');
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return comprehensive stats', async () => {
      await breaker.execute(async () => 'ok');

      const stats = breaker.getStats();

      expect(stats).toHaveProperty('name');
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('successCount');
      expect(stats).toHaveProperty('lastFailureTime');
    });
  });
});
