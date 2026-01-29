import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Stethoscope,
  HeartPulse,
  Activity,
  Syringe,
  Clock,
  Scissors,
  DollarSign,
  Loader2,
  Save,
  FileText,
  Plus,
  Trash2,
  CreditCard,
  Pill,
} from 'lucide-react';
import {
  createEmptyServices,
  ServicesState,
  ConsultationType,
  UltrasoundType,
  ECGType,
  InjectionType,
  SurgeryType,
  MedicineEntry,
} from '@/types/services';
import { useStock } from '@/hooks/useStock';
// import { usePayments } from '@/hooks/usePayments';
import { toast } from 'sonner';

interface AdditionalServicesPanelProps {
  patientId: string;
  patientName: string;
  onSave: (services: ServicesState, grandTotal: number) => Promise<void>;
  onViewSummary: (services: ServicesState, grandTotal: number) => void;
  isSubmitting?: boolean;
}

export function AdditionalServicesPanel({
  patientId,
  patientName,
  onSave,
  onViewSummary,
  isSubmitting = false,
}: AdditionalServicesPanelProps) {
  const [services, setServices] = useState<ServicesState>(createEmptyServices);
  const { stock, reduceStock } = useStock();
  // const { addPayment } = usePayments(); // Moved to Patients.tsx
  const [localSubmitting, setLocalSubmitting] = useState(false);

  // Medicine selection state
  const [selectedStockId, setSelectedStockId] = useState('');
  const [medicineQuantity, setMedicineQuantity] = useState('1');

  // Calculate medicine total
  const medicineFee = useMemo(() => {
    return services.feeCollection.medicines.reduce((sum, m) => sum + m.price * m.quantity, 0);
  }, [services.feeCollection.medicines]);

  // Calculate running total
  const grandTotal = useMemo(() => {
    let total = 0;
    if (services.consultation.enabled) total += services.consultation.fee;
    if (services.ultrasound.enabled) total += services.ultrasound.charges;
    if (services.ecg.enabled) total += services.ecg.charges;
    if (services.injection.enabled) total += services.injection.charges * services.injection.quantity;
    if (services.retention.enabled) total += services.retention.charges;
    if (services.surgery.enabled) {
      total += services.surgery.operationCharges;
      total += services.surgery.otCharges;
      total += services.surgery.anesthesiaCharges;
    }
    // Add fee collection
    total += services.feeCollection.labFee;
    total += medicineFee;
    return total;
  }, [services, medicineFee]);

  const updateConsultation = (updates: Partial<ServicesState['consultation']>) => {
    setServices(prev => ({
      ...prev,
      consultation: { ...prev.consultation, ...updates },
    }));
  };

  const updateUltrasound = (updates: Partial<ServicesState['ultrasound']>) => {
    setServices(prev => ({
      ...prev,
      ultrasound: { ...prev.ultrasound, ...updates },
    }));
  };

  const updateECG = (updates: Partial<ServicesState['ecg']>) => {
    setServices(prev => ({
      ...prev,
      ecg: { ...prev.ecg, ...updates },
    }));
  };

  const updateBPReading = (updates: Partial<ServicesState['bpReading']>) => {
    setServices(prev => ({
      ...prev,
      bpReading: { ...prev.bpReading, ...updates },
    }));
  };

  const updateInjection = (updates: Partial<ServicesState['injection']>) => {
    setServices(prev => ({
      ...prev,
      injection: { ...prev.injection, ...updates },
    }));
  };

  const updateRetention = (updates: Partial<ServicesState['retention']>) => {
    setServices(prev => ({
      ...prev,
      retention: { ...prev.retention, ...updates },
    }));
  };

  const updateSurgery = (updates: Partial<ServicesState['surgery']>) => {
    setServices(prev => ({
      ...prev,
      surgery: { ...prev.surgery, ...updates },
    }));
  };

  const updateFeeCollection = (updates: Partial<ServicesState['feeCollection']>) => {
    setServices(prev => ({
      ...prev,
      feeCollection: { ...prev.feeCollection, ...updates },
    }));
  };

  const handleAddMedicine = () => {
    if (!selectedStockId) {
      toast.error('Please select a medicine');
      return;
    }

    const stockItem = stock.find(s => s.id === selectedStockId);
    if (!stockItem) return;

    const qty = parseInt(medicineQuantity) || 1;
    if (qty > stockItem.quantity) {
      toast.error(`Only ${stockItem.quantity} units available`);
      return;
    }

    const currentMedicines = services.feeCollection.medicines;
    const existingIndex = currentMedicines.findIndex(m => m.stockId === selectedStockId);

    if (existingIndex >= 0) {
      const newQty = currentMedicines[existingIndex].quantity + qty;
      if (newQty > stockItem.quantity) {
        toast.error(`Only ${stockItem.quantity} units available`);
        return;
      }
      const newMedicines = [...currentMedicines];
      newMedicines[existingIndex].quantity = newQty;
      updateFeeCollection({ medicines: newMedicines });
    } else {
      updateFeeCollection({
        medicines: [
          ...currentMedicines,
          { stockId: selectedStockId, name: stockItem.name, quantity: qty, price: stockItem.price },
        ],
      });
    }

    setSelectedStockId('');
    setMedicineQuantity('1');
  };

  const handleRemoveMedicine = (stockId: string) => {
    updateFeeCollection({
      medicines: services.feeCollection.medicines.filter(m => m.stockId !== stockId),
    });
  };

  const handleSave = async () => {
    if (localSubmitting || isSubmitting) return;
    setLocalSubmitting(true);

    try {
      // Validation
      const hasService =
        services.consultation.enabled ||
        services.ultrasound.enabled ||
        services.ecg.enabled ||
        services.bpReading.enabled ||
        services.injection.enabled ||
        services.retention.enabled ||
        services.surgery.enabled ||
        services.feeCollection.labFee > 0 ||
        services.feeCollection.medicines.length > 0;

      if (!hasService) {
        toast.error('Please select at least one service or medicine');
        return;
      }

      if (services.consultation.enabled) {
        if (!services.consultation.doctorName || !services.consultation.fee) {
          toast.error('Consultation: Doctor Name and Fee are required');
          return;
        }
      }
      if (services.ultrasound.enabled) {
        if (!services.ultrasound.charges) {
          toast.error('Ultrasound: Charges are required');
          return;
        }
      }
      if (services.ecg.enabled) {
        if (!services.ecg.charges) {
          toast.error('ECG: Charges are required');
          return;
        }
      }
      if (services.bpReading.enabled) {
        if (!services.bpReading.systolic || !services.bpReading.diastolic || !services.bpReading.pulse) {
          toast.error('BP Reading: All values are required');
          return;
        }
      }
      if (services.injection.enabled) {
        if (!services.injection.name || !services.injection.quantity || !services.injection.charges) {
          toast.error('Injection: Name, Quantity and Charges are required');
          return;
        }
      }
      if (services.retention.enabled) {
        if (!services.retention.duration || !services.retention.charges) {
          toast.error('Retention: Duration and Charges are required');
          return;
        }
      }
      if (services.surgery.enabled) {
        if (!services.surgery.surgeonName || !services.surgery.surgeryDate ||
          (!services.surgery.operationCharges && !services.surgery.otCharges && !services.surgery.anesthesiaCharges)) {
          toast.error('Surgery: Surgeon, Date and at least one charge are required');
          return;
        }
      }

      try {
        // Reduce stock for medicines
        for (const m of services.feeCollection.medicines) {
          await reduceStock(m.stockId, m.quantity);
        }

        await onSave(services, grandTotal);
      } catch (err) {
        console.error(err);
        toast.error('Failed to save services');
      }
    } finally {
      setLocalSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Patient Info and Running Total */}
      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
        <div>
          <h3 className="font-semibold">Services & Fee Collection</h3>
          <p className="text-sm text-muted-foreground">
            Patient: {patientName} ({patientId})
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Running Total</p>
          <p className="text-2xl font-bold text-primary">Rs. {grandTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 1. Consultation */}
        <Card className={services.consultation.enabled ? 'ring-2 ring-primary' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="h-4 w-4" />
                Consultation
              </CardTitle>
              <Switch
                checked={services.consultation.enabled}
                onCheckedChange={(checked) => updateConsultation({ enabled: checked })}
              />
            </div>
          </CardHeader>
          {services.consultation.enabled && (
            <CardContent className="space-y-3">
              <div>
                <Label>Consultation Type</Label>
                <Select
                  value={services.consultation.type}
                  onValueChange={(value: ConsultationType) =>
                    updateConsultation({ type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="Specialist">Specialist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Doctor Name</Label>
                <Input
                  value={services.consultation.doctorName}
                  onChange={(e) => updateConsultation({ doctorName: e.target.value })}
                  placeholder="Dr. Name"
                />
              </div>
              <div>
                <Label>Consultation Fee (Rs.)</Label>
                <Input
                  type="number"
                  min="0"
                  value={services.consultation.fee || ''}
                  onChange={(e) => updateConsultation({ fee: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* 2. Ultrasound */}
        <Card className={services.ultrasound.enabled ? 'ring-2 ring-primary' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <HeartPulse className="h-4 w-4" />
                Ultrasound
              </CardTitle>
              <Switch
                checked={services.ultrasound.enabled}
                onCheckedChange={(checked) => updateUltrasound({ enabled: checked })}
              />
            </div>
          </CardHeader>
          {services.ultrasound.enabled && (
            <CardContent className="space-y-3">
              <div>
                <Label>Ultrasound Type</Label>
                <Select
                  value={services.ultrasound.type}
                  onValueChange={(value: UltrasoundType) =>
                    updateUltrasound({ type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Abdomen">Abdomen</SelectItem>
                    <SelectItem value="Pelvic">Pelvic</SelectItem>
                    <SelectItem value="Pregnancy">Pregnancy</SelectItem>
                    <SelectItem value="Obstetric">Obstetric</SelectItem>
                    <SelectItem value="Thyroid">Thyroid</SelectItem>
                    <SelectItem value="Breast">Breast</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Charges (Rs.)</Label>
                <Input
                  type="number"
                  min="0"
                  value={services.ultrasound.charges || ''}
                  onChange={(e) => updateUltrasound({ charges: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* 3. ECG */}
        <Card className={services.ecg.enabled ? 'ring-2 ring-primary' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                ECG
              </CardTitle>
              <Switch
                checked={services.ecg.enabled}
                onCheckedChange={(checked) => updateECG({ enabled: checked })}
              />
            </div>
          </CardHeader>
          {services.ecg.enabled && (
            <CardContent className="space-y-3">
              <div>
                <Label>ECG Type</Label>
                <Select
                  value={services.ecg.type}
                  onValueChange={(value: ECGType) => updateECG({ type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Resting">Resting</SelectItem>
                    <SelectItem value="Stress">Stress</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Charges (Rs.)</Label>
                <Input
                  type="number"
                  min="0"
                  value={services.ecg.charges || ''}
                  onChange={(e) => updateECG({ charges: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* 4. BP Module */}
        <Card className={services.bpReading.enabled ? 'ring-2 ring-primary' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                BP Reading
              </CardTitle>
              <Switch
                checked={services.bpReading.enabled}
                onCheckedChange={(checked) => updateBPReading({ enabled: checked })}
              />
            </div>
          </CardHeader>
          {services.bpReading.enabled && (
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Systolic</Label>
                  <Input
                    type="number"
                    min="0"
                    value={services.bpReading.systolic || ''}
                    onChange={(e) => updateBPReading({ systolic: parseInt(e.target.value) || 0 })}
                    placeholder="120"
                  />
                </div>
                <div>
                  <Label>Diastolic</Label>
                  <Input
                    type="number"
                    min="0"
                    value={services.bpReading.diastolic || ''}
                    onChange={(e) => updateBPReading({ diastolic: parseInt(e.target.value) || 0 })}
                    placeholder="80"
                  />
                </div>
                <div>
                  <Label>Pulse</Label>
                  <Input
                    type="number"
                    min="0"
                    value={services.bpReading.pulse || ''}
                    onChange={(e) => updateBPReading({ pulse: parseInt(e.target.value) || 0 })}
                    placeholder="72"
                  />
                </div>
              </div>
              <div>
                <Label>Recorded Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={services.bpReading.recordedAt.slice(0, 16)}
                  onChange={(e) => updateBPReading({ recordedAt: new Date(e.target.value).toISOString() })}
                />
              </div>
              <Badge variant="outline" className="w-full justify-center">
                BP: {services.bpReading.systolic}/{services.bpReading.diastolic} mmHg | Pulse: {services.bpReading.pulse} bpm
              </Badge>
            </CardContent>
          )}
        </Card>

        {/* 5. Injection Charges */}
        <Card className={services.injection.enabled ? 'ring-2 ring-primary' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Syringe className="h-4 w-4" />
                Injection Charges
              </CardTitle>
              <Switch
                checked={services.injection.enabled}
                onCheckedChange={(checked) => updateInjection({ enabled: checked })}
              />
            </div>
          </CardHeader>
          {services.injection.enabled && (
            <CardContent className="space-y-3">
              <div>
                <Label>Injection Type</Label>
                <Select
                  value={services.injection.type}
                  onValueChange={(value: InjectionType) => updateInjection({ type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IV">Intravenous (IV)</SelectItem>
                    <SelectItem value="IM">Intramuscular (IM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Injection Name</Label>
                <Input
                  value={services.injection.name}
                  onChange={(e) => updateInjection({ name: e.target.value })}
                  placeholder="Injection name"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={services.injection.quantity || ''}
                    onChange={(e) => updateInjection({ quantity: parseInt(e.target.value) || 1 })}
                    placeholder="1"
                  />
                </div>
                <div>
                  <Label>Charges (Rs.)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={services.injection.charges || ''}
                    onChange={(e) => updateInjection({ charges: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* 6. Retention Charges */}
        <Card className={services.retention.enabled ? 'ring-2 ring-primary' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Retention Charges
              </CardTitle>
              <Switch
                checked={services.retention.enabled}
                onCheckedChange={(checked) => updateRetention({ enabled: checked })}
              />
            </div>
          </CardHeader>
          {services.retention.enabled && (
            <CardContent className="space-y-3">
              <div>
                <Label>Retention Duration</Label>
                <Input
                  value={services.retention.duration}
                  onChange={(e) => updateRetention({ duration: e.target.value })}
                  placeholder="e.g., 2 hours, 1 day"
                />
              </div>
              <div>
                <Label>Charges (Rs.)</Label>
                <Input
                  type="number"
                  min="0"
                  value={services.retention.charges || ''}
                  onChange={(e) => updateRetention({ charges: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* 7. Surgery */}
        <Card className={`md:col-span-2 ${services.surgery.enabled ? 'ring-2 ring-primary' : ''}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Scissors className="h-4 w-4" />
                Surgery
              </CardTitle>
              <Switch
                checked={services.surgery.enabled}
                onCheckedChange={(checked) => updateSurgery({ enabled: checked })}
              />
            </div>
          </CardHeader>
          {services.surgery.enabled && (
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label>Surgery Type</Label>
                  <Select
                    value={services.surgery.type}
                    onValueChange={(value: SurgeryType) =>
                      updateSurgery({ type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Cesarean">Cesarean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Surgeon Name</Label>
                  <Input
                    value={services.surgery.surgeonName}
                    onChange={(e) => updateSurgery({ surgeonName: e.target.value })}
                    placeholder="Dr. Surgeon"
                  />
                </div>
                <div>
                  <Label>Surgery Date</Label>
                  <Input
                    type="date"
                    value={services.surgery.surgeryDate}
                    onChange={(e) => updateSurgery({ surgeryDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Operation Charges (Rs.)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={services.surgery.operationCharges || ''}
                    onChange={(e) => updateSurgery({ operationCharges: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>OT Charges (Rs.)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={services.surgery.otCharges || ''}
                    onChange={(e) => updateSurgery({ otCharges: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Anesthesia Charges (Rs.)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={services.surgery.anesthesiaCharges || ''}
                    onChange={(e) => updateSurgery({ anesthesiaCharges: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* 8. Fee Collection - Always visible */}
        <Card className="md:col-span-2 ring-2 ring-green-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                Fee Collection
              </CardTitle>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Required
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lab Fee (Rs.)</Label>
                <Input
                  type="number"
                  min="0"
                  value={services.feeCollection.labFee || ''}
                  onChange={(e) => updateFeeCollection({ labFee: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Payment Mode</Label>
                <Select
                  value={services.feeCollection.paymentMode}
                  onValueChange={(value: 'Cash' | 'Card') => updateFeeCollection({ paymentMode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Add Medicine */}
            <div className="border-t pt-4">
              <Label className="mb-2 flex items-center gap-2">
                <Pill className="h-4 w-4" />
                Add Medicines from Stock
              </Label>
              <div className="flex gap-2">
                <Select value={selectedStockId} onValueChange={setSelectedStockId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select medicine" />
                  </SelectTrigger>
                  <SelectContent>
                    {stock.filter(s => s.quantity > 0).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} (Rs. {item.price}) - {item.quantity} left
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  value={medicineQuantity}
                  onChange={(e) => setMedicineQuantity(e.target.value)}
                  className="w-20"
                  placeholder="Qty"
                />
                <Button type="button" variant="secondary" onClick={handleAddMedicine}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Selected Medicines */}
            {services.feeCollection.medicines.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Medicines</Label>
                {services.feeCollection.medicines.map((m) => (
                  <div
                    key={m.stockId}
                    className="flex items-center justify-between p-2 rounded bg-muted"
                  >
                    <span className="text-sm">
                      {m.name} × {m.quantity}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Rs. {m.price * m.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => handleRemoveMedicine(m.stockId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="text-right text-sm font-medium">
                  Medicine Total: Rs. {medicineFee.toLocaleString()}
                </div>
              </div>
            )}

            {/* Fee Breakdown */}
            <div className="border-t pt-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consultation:</span>
                <span>Rs. {services.consultation.enabled ? services.consultation.fee : 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lab Fee:</span>
                <span>Rs. {services.feeCollection.labFee}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Medicines:</span>
                <span>Rs. {medicineFee}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Other Services:</span>
                <span>Rs. {(
                  (services.ultrasound.enabled ? services.ultrasound.charges : 0) +
                  (services.ecg.enabled ? services.ecg.charges : 0) +
                  (services.injection.enabled ? services.injection.charges * services.injection.quantity : 0) +
                  (services.retention.enabled ? services.retention.charges : 0) +
                  (services.surgery.enabled ? services.surgery.operationCharges + services.surgery.otCharges + services.surgery.anesthesiaCharges : 0)
                ).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Footer */}
      <Separator />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold">Grand Total: Rs. {grandTotal.toLocaleString()}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onViewSummary(services, grandTotal)}>
            <FileText className="mr-2 h-4 w-4" />
            View Summary
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting || localSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save & Record Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
