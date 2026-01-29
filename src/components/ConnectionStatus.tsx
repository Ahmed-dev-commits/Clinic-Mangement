import { useState, useEffect } from 'react';
import { healthCheck } from '@/services/accessApi';
import { supabaseHealthCheck } from '@/services/supabaseApi';
import { isCloudEnvironment } from '@/lib/environment';
import { Badge } from '@/components/ui/badge';
import { Database, Cloud, WifiOff } from 'lucide-react';

export function ConnectionStatus() {
  const [status, setStatus] = useState<'checking' | 'cloud' | 'sqlite' | 'disconnected'>('checking');

  useEffect(() => {
    const checkConnection = async () => {
      // Check if running in cloud environment
      if (isCloudEnvironment()) {
        try {
          const ok = await supabaseHealthCheck();
          setStatus(ok ? 'cloud' : 'disconnected');
        } catch {
          setStatus('disconnected');
        }
      } else {
        // Try local SQLite backend
        try {
          await healthCheck();
          setStatus('sqlite');
        } catch {
          setStatus('disconnected');
        }
      }
    };

    checkConnection();
    
    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  if (status === 'checking') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Database className="h-3 w-3 animate-pulse" />
        Checking...
      </Badge>
    );
  }

  if (status === 'cloud') {
    return (
      <Badge variant="default" className="gap-1 bg-blue-600 hover:bg-blue-700">
        <Cloud className="h-3 w-3" />
        Cloud Connected
      </Badge>
    );
  }

  if (status === 'sqlite') {
    return (
      <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
        <Database className="h-3 w-3" />
        SQLite Connected
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="gap-1">
      <WifiOff className="h-3 w-3" />
      Demo Mode
    </Badge>
  );
}
