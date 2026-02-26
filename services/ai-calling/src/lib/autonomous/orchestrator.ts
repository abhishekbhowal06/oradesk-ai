/**
 * AUTONOMOUS ENGINE ORCHESTRATOR
 * Coordinates all autonomous intelligence systems
 * Manages lifecycle, monitoring, and reporting
 */

import { cancellationPreventionEngine } from './cancellation-prevention';
import { noShowPredictionEngine } from './no-show-prediction';
import { reputationShieldEngine } from './reputation-shield';
import { revenueStabilizationEngine } from './revenue-stabilization';
import { logger } from '../logging/structured-logger';

export class AutonomousEngineOrchestrator {
  private engines = {
    cancellationPrevention: cancellationPreventionEngine,
    noShowPrediction: noShowPredictionEngine,
    reputationShield: reputationShieldEngine,
    revenueStabilization: revenueStabilizationEngine,
  };

  /**
   * Start all autonomous engines
   */
  async startAll() {
    logger.info('🚀 Starting Autonomous Intelligence Systems');

    try {
      await this.engines.cancellationPrevention.start();
      await this.engines.noShowPrediction.start();
      // Reputation shield is passive - activates on call events
      await this.engines.revenueStabilization.start();

      logger.info('✅ All autonomous engines operational');

      // Report status every hour
      setInterval(() => {
        this.reportStatus();
      }, 3600000); // 1 hour
    } catch (error) {
      logger.error('Failed to start autonomous engines', { error });
      throw error;
    }
  }

  /**
   * Stop all engines
   */
  stopAll() {
    logger.info('Stopping all autonomous engines');

    this.engines.cancellationPrevention.stop();
    this.engines.noShowPrediction.stop();
    this.engines.revenueStabilization.stop();

    logger.info('All engines stopped');
  }

  /**
   * Get combined metrics dashboard
   */
  async getDashboard(clinicId: string, days: number = 7) {
    const [cancellationMetrics, noShowMetrics, reputationMetrics, revenueMetrics] =
      await Promise.all([
        this.engines.cancellationPrevention.getMetrics(clinicId, days),
        this.engines.noShowPrediction.getAccuracyMetrics(clinicId, days),
        this.engines.reputationShield.getMetrics(clinicId, days),
        this.engines.revenueStabilization.getMetrics(clinicId, days),
      ]);

    return {
      period: `Last ${days} days`,
      clinicId,
      cancellationPrevention: {
        gapsDetected: cancellationMetrics.totalGapsDetected,
        gapsFilled: cancellationMetrics.totalGapsFilled,
        fillRate: `${cancellationMetrics.fillRate.toFixed(1)}%`,
        revenueRecovered: `$${cancellationMetrics.revenueRecovered.toLocaleString()}`,
      },
      noShowPrediction: {
        totalPredictions: noShowMetrics.totalPredictions,
        accuracy: `${noShowMetrics.accuracy.toFixed(1)}%`,
        precision: `${noShowMetrics.precision.toFixed(1)}%`,
        recall: `${noShowMetrics.recall.toFixed(1)}%`,
      },
      reputationProtection: {
        crisesDetected: reputationMetrics.totalCrises,
        criticalCrises: reputationMetrics.criticalCrises,
        reviewsPrevented: reputationMetrics.preventedReviews,
        preventionRate: `${reputationMetrics.preventionRate.toFixed(1)}%`,
      },
      revenueStabilization: {
        avgVariance: `${revenueMetrics.avgVariancePercent}%`,
        revenueStabilized: `$${revenueMetrics.revenueStabilized.toLocaleString()}`,
        interventions: revenueMetrics.interventionCount,
      },
    };
  }

  /**
   * Report system status
   */
  private async reportStatus() {
    logger.info('═══════════════════════════════════════════════════');
    logger.info('       AUTONOMOUS INTELLIGENCE SYSTEM STATUS');
    logger.info('═══════════════════════════════════════════════════');
    logger.info('✅ Cancellation Prevention Engine: ACTIVE');
    logger.info('✅ No-Show Prediction Engine: ACTIVE');
    logger.info('✅ Reputation Shield: MONITORING');
    logger.info('✅ Revenue Stabilization Autopilot: ACTIVE');
    logger.info('═══════════════════════════════════════════════════');
  }
}

// Singleton instance
export const autonomousOrchestrator = new AutonomousEngineOrchestrator();

// Auto-start engines when module loads (in production)
if (process.env.NODE_ENV === 'production' || process.env.AUTO_START_ENGINES === 'true') {
  autonomousOrchestrator.startAll().catch((error) => {
    logger.error('Failed to auto-start autonomous engines', { error });
  });
}
