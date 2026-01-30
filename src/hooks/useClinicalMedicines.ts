import { useState, useEffect, useCallback } from 'react';
import { clinicalMedicinesApi, ClinicalMedicineDTO } from '@/services/accessApi';
import { toast } from 'sonner';

export interface ClinicalMedicine {
    id: number;
    name: string;
    category: string;
    dosage: string;
    frequency: string;
    duration: string;
}

export function useClinicalMedicines() {
    const [medicines, setMedicines] = useState<ClinicalMedicine[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMedicines = useCallback(async () => {
        try {
            setLoading(true);
            const data = await clinicalMedicinesApi.getAll();
            setMedicines(data.map(dto => ({
                id: dto.ID,
                name: dto.MedicineName,
                category: dto.Category || 'Tablet',
                dosage: dto.Dosage,
                frequency: dto.Frequency,
                duration: dto.Duration
            })));
        } catch (err) {
            console.error('Error fetching clinical medicines:', err);
            toast.error('Failed to load medicines list');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMedicines();
    }, [fetchMedicines]);

    const addMedicine = async (medicine: Omit<ClinicalMedicine, 'id'>) => {
        try {
            await clinicalMedicinesApi.create({
                name: medicine.name,
                category: medicine.category,
                dosage: medicine.dosage,
                frequency: medicine.frequency,
                duration: medicine.duration
            });
            await fetchMedicines();
            return true;
        } catch (err) {
            toast.error('Failed to add medicine');
            return false;
        }
    };

    const updateMedicine = async (id: number, medicine: Omit<ClinicalMedicine, 'id'>) => {
        try {
            await clinicalMedicinesApi.update(id, {
                name: medicine.name,
                category: medicine.category,
                dosage: medicine.dosage,
                frequency: medicine.frequency,
                duration: medicine.duration
            });
            await fetchMedicines();
            return true;
        } catch (err) {
            toast.error('Failed to update medicine');
            return false;
        }
    };

    const deleteMedicine = async (id: number) => {
        try {
            await clinicalMedicinesApi.delete(id);
            await fetchMedicines();
            return true;
        } catch (err) {
            toast.error('Failed to delete medicine');
            return false;
        }
    };

    return {
        medicines,
        loading,
        addMedicine,
        updateMedicine,
        deleteMedicine,
        refetch: fetchMedicines
    };
}
