import { useState, useMemo } from 'react';
import { useAccessPatients } from '@/hooks/useAccessPatients';
import { usePayments } from '@/hooks/usePayments';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, RefreshCw, X, CalendarIcon } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { Payment } from '@/types/hospital';
import { PaymentReceiptDialog } from '@/components/fees/PaymentReceiptDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export function FeesPage() {
  const { payments, loading, refetch } = usePayments();
  const { patients } = useAccessPatients();

  // Debug logging
  console.log('Fees Page Data:', {
    paymentsCount: payments?.length,
    patientsCount: patients?.length,
    loading
  });

  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState<string>('');

  // Safe date formatter
  const safeFormatDate = (dateString: string | undefined, formatStr: string = 'MMM dd, yyyy HH:mm'): string => {
    if (!dateString) return 'Invalid date';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? 'Invalid date' : format(date, formatStr);
    } catch {
      return 'Invalid date';
    }
  };

  // Receipt dialog states
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentReceiptOpen, setPaymentReceiptOpen] = useState(false);

  // Filter function for date range
  const isInDateRange = (dateString: string | undefined) => {
    if (!dateString) return true;
    if (!startDate && !endDate) return true;

    try {
      const recordDate = new Date(dateString);
      if (isNaN(recordDate.getTime())) return true;

      if (startDate && endDate) {
        return isWithinInterval(recordDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
      }
      if (startDate) return recordDate >= startOfDay(startDate);
      if (endDate) return recordDate <= endOfDay(endDate);
      return true;
    } catch {
      return true;
    }
  };

  const clearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setQuickFilter('');
  };

  const handleQuickFilter = (value: string) => {
    setQuickFilter(value);
    const today = new Date();

    switch (value) {
      case 'today':
        setStartDate(startOfDay(today));
        setEndDate(endOfDay(today));
        break;
      case 'last7days':
        setStartDate(startOfDay(subDays(today, 6)));
        setEndDate(endOfDay(today));
        break;
      case 'week':
        setStartDate(startOfWeek(today, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(today, { weekStartsOn: 1 }));
        break;
      case 'month':
        setStartDate(startOfMonth(today));
        setEndDate(endOfMonth(today));
        break;
      default:
        setStartDate(undefined);
        setEndDate(undefined);
    }
  };

  const handleManualDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    setQuickFilter('');
    if (type === 'start') {
      setStartDate(date);
    } else {
      setEndDate(date);
    }
  };

  // Filtered payments
  const filteredPayments = useMemo(() => {
    const safePayments = Array.isArray(payments) ? payments : [];
    return safePayments.filter(p => p && p.createdAt && isInDateRange(p.createdAt));
  }, [payments, startDate, endDate]);

  // Total Collection
  const filteredTotal = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + Number(p?.totalAmount || 0), 0);
  }, [filteredPayments]);

  const handleViewPaymentReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setPaymentReceiptOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Transaction Section"
        description="View and manage all transaction records"
        action={
          <div className="flex items-center gap-3">
            <ConnectionStatus />
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {/* Show loading state */}
      {loading && !payments.length ? (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <p className="text-muted-foreground">Loading transaction data...</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Date Range Filter */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Quick filters:</span>
              <ToggleGroup type="single" value={quickFilter} onValueChange={handleQuickFilter}>
                <ToggleGroupItem value="today" aria-label="Today" className="text-xs px-3">
                  Today
                </ToggleGroupItem>
                <ToggleGroupItem value="last7days" aria-label="Last 7 Days" className="text-xs px-3">
                  Last 7 Days
                </ToggleGroupItem>
                <ToggleGroupItem value="week" aria-label="This Week" className="text-xs px-3">
                  This Week
                </ToggleGroupItem>
                <ToggleGroupItem value="month" aria-label="This Month" className="text-xs px-3">
                  This Month
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Custom:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM dd, yyyy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(date) => handleManualDateChange('start', date)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM dd, yyyy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(date) => handleManualDateChange('end', date)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {(startDate || endDate) && (
                <Button variant="ghost" size="icon" onClick={clearDateFilter} title="Clear filter">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {startDate || endDate ? 'Filtered Total' : "Today's Collection"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">Rs. {filteredTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredPayments.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Records Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Transaction Records</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {filteredPayments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No payment records found</p>
            ) : (
              filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{payment.patientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {safeFormatDate(payment.createdAt)}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {Number(payment.consultationFee || 0) > 0 && (
                        <Badge variant="outline" className="text-xs">Consult: Rs.{Number(payment.consultationFee).toFixed(2)}</Badge>
                      )}
                      {Number(payment.labFee || 0) > 0 && (
                        <Badge variant="outline" className="text-xs">Lab: Rs.{Number(payment.labFee).toFixed(2)}</Badge>
                      )}
                      {Number(payment.medicineFee || 0) > 0 && (
                        <Badge variant="outline" className="text-xs">Med: Rs.{Number(payment.medicineFee).toFixed(2)}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-primary">Rs. {Number(payment.totalAmount || 0).toFixed(2)}</p>
                      <Badge variant={payment.paymentMode === 'Card' ? 'default' : 'secondary'}>
                        {payment.paymentMode}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewPaymentReceipt(payment)}
                      title="View Receipt"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <PaymentReceiptDialog
        open={paymentReceiptOpen}
        onOpenChange={setPaymentReceiptOpen}
        payment={selectedPayment}
        patient={patients.find(p => p.id === selectedPayment?.patientId) || null}
      />
    </div>
  );
}
