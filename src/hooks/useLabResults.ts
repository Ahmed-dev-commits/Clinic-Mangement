import { useState, useEffect, useCallback } from 'react';
import { labResultsApi, LabResultDTO } from '@/services/accessApi';
import { supabaseLabResultsApi, LabResultRow } from '@/services/supabaseApi';
import { isCloudEnvironment } from '@/lib/environment';
import { LabResult, LabTestResult, LabResultStatus } from '@/types/hospital';
import type { Json } from '@/integrations/supabase/types';

// Get demo lab results from localStorage
function getDemoLabResults(): LabResult[] {
  try {
    const stored = localStorage.getItem('demo-lab-results');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.log('Failed to parse demo lab results');
  }
  return [];
}

// Save demo lab results to localStorage
function saveDemoLabResults(labResults: LabResult[]) {
  localStorage.setItem('demo-lab-results', JSON.stringify(labResults));
}

// Convert API DTO to local type
function dtoToLabResult(dto: LabResultDTO): LabResult {
  return {
    id: dto.ID,
    patientId: dto.PatientID,
    patientName: dto.PatientName,
    patientAge: dto.PatientAge,
    testDate: dto.TestDate,
    reportDate: dto.ReportDate,
    tests: typeof dto.Tests === 'string' ? JSON.parse(dto.Tests) : [],
    notes: dto.Notes,
    technician: dto.Technician,
    status: dto.Status as LabResultStatus,
    notifiedAt: dto.NotifiedAt,
    collectedAt: dto.CollectedAt,
    createdAt: dto.CreatedAt,
  };
}

// Convert Supabase row to local type
function rowToLabResult(row: LabResultRow): LabResult {
  return {
    id: row.id,
    patientId: row.patient_id || '',
    patientName: row.patient_name || '',
    patientAge: row.patient_age || 0,
    testDate: row.test_date || '',
    reportDate: row.report_date || '',
    tests: Array.isArray(row.tests) ? row.tests as unknown as LabTestResult[] : [],
    notes: row.notes || '',
    technician: row.technician || '',
    status: (row.status as LabResultStatus) || 'Sample Collected',
    notifiedAt: row.notified_at || undefined,
    collectedAt: row.collected_at || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

// Generate unique ID
const generateId = (prefix: string) => {
  const num = Math.floor(Math.random() * 9000) + 1000;
  const suffix = Math.random().toString(36).substr(2, 3).toUpperCase();
  return `${prefix}-${num}${suffix}`;
};

export function useLabResults() {
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isCloud, setIsCloud] = useState(false);

  const fetchLabResults = useCallback(async () => {
    try {
      setLoading(true);
      
      if (isCloudEnvironment()) {
        setIsCloud(true);
        const data = await supabaseLabResultsApi.getAll();
        setLabResults(data.map(rowToLabResult));
        setIsDemoMode(false);
      } else {
        setIsCloud(false);
        try {
          const data = await labResultsApi.getAll();
          setLabResults(data.map(dtoToLabResult));
          setIsDemoMode(false);
        } catch {
          console.log('Backend unavailable, using demo mode for lab results');
          setLabResults(getDemoLabResults());
          setIsDemoMode(true);
        }
      }
    } catch (err) {
      console.error('Error fetching lab results:', err);
      setLabResults(getDemoLabResults());
      setIsDemoMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabResults();
  }, [fetchLabResults]);

  const addLabResult = async (labResultData: Omit<LabResult, 'id' | 'createdAt'>) => {
    const id = generateId('LAB');
    
    if (isCloud) {
      await supabaseLabResultsApi.create({
        id,
        patient_id: labResultData.patientId,
        patient_name: labResultData.patientName,
        patient_age: labResultData.patientAge,
        test_date: labResultData.testDate,
        report_date: labResultData.reportDate,
        tests: labResultData.tests as unknown as Json,
        notes: labResultData.notes,
        technician: labResultData.technician,
        status: labResultData.status,
        notified_at: labResultData.notifiedAt || null,
        collected_at: labResultData.collectedAt || null,
      });
      await fetchLabResults();
      return id;
    }

    if (isDemoMode) {
      const newLabResult: LabResult = { ...labResultData, id, createdAt: new Date().toISOString() };
      const updated = [...labResults, newLabResult];
      setLabResults(updated);
      saveDemoLabResults(updated);
      return id;
    }

    try {
      await labResultsApi.create({
        id,
        patientId: labResultData.patientId,
        patientName: labResultData.patientName,
        patientAge: labResultData.patientAge,
        testDate: labResultData.testDate,
        reportDate: labResultData.reportDate,
        tests: labResultData.tests,
        notes: labResultData.notes,
        technician: labResultData.technician,
        status: labResultData.status,
      });
      await fetchLabResults();
      return id;
    } catch {
      const newLabResult: LabResult = { ...labResultData, id, createdAt: new Date().toISOString() };
      const updated = [...labResults, newLabResult];
      setLabResults(updated);
      saveDemoLabResults(updated);
      setIsDemoMode(true);
      return id;
    }
  };

  const updateLabResultStatus = async (id: string, status: LabResultStatus) => {
    if (isCloud) {
      await supabaseLabResultsApi.updateStatus(id, status);
      await fetchLabResults();
      return;
    }

    if (isDemoMode) {
      const updated = labResults.map(l => l.id === id ? { ...l, status } : l);
      setLabResults(updated);
      saveDemoLabResults(updated);
      return;
    }

    try {
      await labResultsApi.updateStatus(id, status);
      await fetchLabResults();
    } catch {
      const updated = labResults.map(l => l.id === id ? { ...l, status } : l);
      setLabResults(updated);
      saveDemoLabResults(updated);
      setIsDemoMode(true);
    }
  };

  const notifyPatient = async (id: string) => {
    const notifiedAt = new Date().toISOString();
    
    if (isCloud) {
      await supabaseLabResultsApi.updateStatus(id, 'Notified', notifiedAt);
      await fetchLabResults();
      return;
    }

    if (isDemoMode) {
      const updated = labResults.map(l => 
        l.id === id ? { ...l, status: 'Notified' as LabResultStatus, notifiedAt } : l
      );
      setLabResults(updated);
      saveDemoLabResults(updated);
      return;
    }

    try {
      await labResultsApi.updateStatus(id, 'Notified', notifiedAt);
      await fetchLabResults();
    } catch {
      const updated = labResults.map(l => 
        l.id === id ? { ...l, status: 'Notified' as LabResultStatus, notifiedAt } : l
      );
      setLabResults(updated);
      saveDemoLabResults(updated);
      setIsDemoMode(true);
    }
  };

  const markAsCollected = async (id: string) => {
    const collectedAt = new Date().toISOString();
    
    if (isCloud) {
      await supabaseLabResultsApi.updateStatus(id, 'Collected', undefined, collectedAt);
      await fetchLabResults();
      return;
    }

    if (isDemoMode) {
      const updated = labResults.map(l => 
        l.id === id ? { ...l, status: 'Collected' as LabResultStatus, collectedAt } : l
      );
      setLabResults(updated);
      saveDemoLabResults(updated);
      return;
    }

    try {
      await labResultsApi.updateStatus(id, 'Collected', undefined, collectedAt);
      await fetchLabResults();
    } catch {
      const updated = labResults.map(l => 
        l.id === id ? { ...l, status: 'Collected' as LabResultStatus, collectedAt } : l
      );
      setLabResults(updated);
      saveDemoLabResults(updated);
      setIsDemoMode(true);
    }
  };

  const getPatientLabResults = (patientId: string) => labResults.filter(l => l.patientId === patientId);

  return {
    labResults,
    loading,
    isDemoMode,
    isCloud,
    addLabResult,
    updateLabResultStatus,
    notifyPatient,
    markAsCollected,
    getPatientLabResults,
    refetch: fetchLabResults,
  };
}
