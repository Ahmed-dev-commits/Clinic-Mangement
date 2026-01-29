import React, { Component, ErrorInfo, ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        toast.error(`Application Error: ${error.message}`);
    }

    private handleRefresh = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
                    <div className="mb-4 rounded-full bg-destructive/10 p-4 text-destructive">
                        <AlertTriangle className="h-12 w-12" />
                    </div>
                    <h1 className="mb-2 text-2xl font-bold tracking-tight">Something went wrong</h1>
                    <p className="mb-6 max-w-md text-muted-foreground">
                        We encountered an unexpected error. The application has gathered diagnostic information.
                    </p>

                    <div className="mb-6 max-w-lg rounded-md bg-muted p-4 text-left font-mono text-sm overflow-auto max-h-40">
                        {this.state.error?.message}
                    </div>

                    <div className="flex gap-4">
                        <Button onClick={this.handleRefresh} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Reload Application
                        </Button>
                        <Button variant="outline" onClick={() => this.setState({ hasError: false })}>
                            Try Again
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
