import { useEffect, useState } from 'react';
import { useSmsNotificationStore, SmsStatus } from '@/store/smsNotificationStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MessageSquare, CheckCircle, Loader2, XCircle, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const getStatusIcon = (status: SmsStatus) => {
  switch (status) {
    case 'queued':
      return <Clock className="h-3 w-3 text-muted-foreground" />;
    case 'sending':
      return <Loader2 className="h-3 w-3 text-primary animate-spin" />;
    case 'delivered':
      return <CheckCircle className="h-3 w-3 text-green-600" />;
    case 'failed':
      return <XCircle className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
};

const getStatusBadge = (status: SmsStatus) => {
  switch (status) {
    case 'queued':
      return <Badge variant="secondary" className="text-xs">Queued</Badge>;
    case 'sending':
      return <Badge className="bg-primary/20 text-primary text-xs">Sending...</Badge>;
    case 'delivered':
      return <Badge className="bg-green-100 text-green-800 text-xs">Delivered</Badge>;
    case 'failed':
      return <Badge variant="destructive" className="text-xs">Failed</Badge>;
    default:
      return null;
  }
};

export function SmsNotificationPanel() {
  const { notifications, clearNotifications } = useSmsNotificationStore();
  const [isOpen, setIsOpen] = useState(false);

  // Auto-open panel when new notification arrives
  const [lastCount, setLastCount] = useState(0);
  
  useEffect(() => {
    if (notifications.length > lastCount && notifications.length > 0) {
      setIsOpen(true);
    }
    setLastCount(notifications.length);
  }, [notifications.length, lastCount]);

  const pendingCount = notifications.filter(n => n.status === 'sending' || n.status === 'queued').length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-2">
          <MessageSquare className="h-4 w-4" />
          SMS
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center animate-pulse">
              {pendingCount}
            </span>
          )}
          {notifications.length > 0 && pendingCount === 0 && (
            <Badge variant="secondary" className="text-xs ml-1">
              {notifications.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Notifications
          </SheetTitle>
          <SheetDescription>
            Real-time status of sent SMS notifications
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-4">
          {notifications.length > 0 && (
            <div className="flex justify-end mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
                className="text-muted-foreground text-xs gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Clear All
              </Button>
            </div>
          )}
          
          <ScrollArea className="h-[calc(100vh-200px)]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm">No SMS notifications yet</p>
                <p className="text-xs mt-1">Notifications will appear here in real-time</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border transition-all duration-300 ${
                      notification.status === 'sending' 
                        ? 'border-primary/50 bg-primary/5 shadow-sm' 
                        : notification.status === 'delivered'
                        ? 'border-green-200 bg-green-50/50'
                        : notification.status === 'failed'
                        ? 'border-destructive/50 bg-destructive/5'
                        : 'border-border bg-background'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(notification.status)}
                        <span className="font-medium text-sm">{notification.patientName}</span>
                      </div>
                      {getStatusBadge(notification.status)}
                    </div>
                    
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                        {notification.to}
                      </span>
                    </div>
                    
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{notification.id}</span>
                      <span>{format(new Date(notification.updatedAt), 'HH:mm:ss')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
