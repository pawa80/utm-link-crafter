import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AlertTriangle, RotateCcw, ExternalLink } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showFallback?: boolean;
  maxRetries?: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount < maxRetries) {
      this.setState({ 
        hasError: false, 
        error: undefined, 
        errorInfo: undefined,
        retryCount: this.state.retryCount + 1
      });
    }
  };

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      retryCount: 0
    });
  };

  render() {
    const { maxRetries = 3, showFallback = true } = this.props;
    
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      if (showFallback) {
        const canRetry = this.state.retryCount < maxRetries;
        
        return (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-destructive" />
              </div>
              <CardTitle className="text-xl font-bold text-destructive">
                Chat Wizard Error
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {canRetry 
                  ? 'Something went wrong. You can try again or use manual campaign creation.' 
                  : 'Multiple errors occurred. Please try manual campaign creation.'}
              </p>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {canRetry && (
                  <Button onClick={this.handleRetry} variant="outline" className="min-w-32">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again ({maxRetries - this.state.retryCount} left)
                  </Button>
                )}
                <Button onClick={this.handleReset} variant="outline" className="min-w-32">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Start Over
                </Button>
                <Button 
                  onClick={() => window.location.href = '/new-campaign'} 
                  variant="default" 
                  className="min-w-32"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Manual Creation
                </Button>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left text-xs text-muted-foreground mt-4">
                  <summary className="cursor-pointer">Error Details (Development)</summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {this.state.error.message}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        );
      }
    }

    return this.props.children;
  }
}

export default ErrorBoundary;