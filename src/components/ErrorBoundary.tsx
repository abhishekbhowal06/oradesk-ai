import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    eventId: string | null;
}

/**
 * Global Error Boundary — Production Grade
 * 
 * Catches all unhandled React errors, displays a branded fallback UI,
 * and reports errors to monitoring infrastructure.
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
        eventId: null,
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const eventId = `eb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        this.setState({ error, errorInfo, eventId });

        // ─── MONITORING HOOK ─────────────────────────────────────
        // Report to external monitoring service (e.g., Sentry, Datadog)
        this.reportError(error, errorInfo, eventId);
    }

    private reportError(error: Error, errorInfo: ErrorInfo, eventId: string) {
        // Structured error log for production monitoring
        const errorReport = {
            eventId,
            message: error.message,
            name: error.name,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
        };

        // Console logging (always)
        console.error('[ErrorBoundary] Uncaught error:', errorReport);

        // Beacon API for guaranteed delivery even during page unload
        try {
            if (navigator.sendBeacon) {
                const apiUrl = import.meta.env?.VITE_API_URL || '';
                if (apiUrl) {
                    navigator.sendBeacon(
                        `${apiUrl}/v1/ops/client-error`,
                        JSON.stringify(errorReport)
                    );
                }
            }
        } catch {
            // Silently fail — we don't want error reporting to cause more errors
        }
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            // Custom fallback provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default production-grade fallback UI
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    padding: '24px',
                }}>
                    <div style={{
                        maxWidth: '480px',
                        width: '100%',
                        background: 'white',
                        borderRadius: '16px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                        padding: '48px 32px',
                        textAlign: 'center',
                    }}>
                        {/* Error Icon */}
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px',
                            fontSize: '28px',
                        }}>
                            ⚠️
                        </div>

                        <h1 style={{
                            fontSize: '22px',
                            fontWeight: 700,
                            color: '#1e293b',
                            margin: '0 0 8px',
                            letterSpacing: '-0.02em',
                        }}>
                            Something went wrong
                        </h1>

                        <p style={{
                            fontSize: '15px',
                            color: '#64748b',
                            margin: '0 0 32px',
                            lineHeight: 1.6,
                        }}>
                            An unexpected error occurred. Our team has been notified automatically
                            and is working on a fix.
                        </p>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    padding: '10px 24px',
                                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                                }}
                            >
                                Try Again
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                style={{
                                    padding: '10px 24px',
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                Go to Dashboard
                            </button>
                        </div>

                        {/* Error Reference ID */}
                        {this.state.eventId && (
                            <p style={{
                                fontSize: '12px',
                                color: '#94a3b8',
                                marginTop: '24px',
                                fontFamily: 'monospace',
                            }}>
                                Reference: {this.state.eventId}
                            </p>
                        )}

                        {/* Dev-only expandable details */}
                        {import.meta.env?.DEV && this.state.error && (
                            <details style={{
                                marginTop: '24px',
                                textAlign: 'left',
                                background: '#fef2f2',
                                borderRadius: '8px',
                                padding: '12px',
                                fontSize: '12px',
                                color: '#991b1b',
                            }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '8px' }}>
                                    Developer Details
                                </summary>
                                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                                    {this.state.error.toString()}
                                    {'\n\n'}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
