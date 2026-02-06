import { create } from 'zustand';
import { toast } from 'sonner';
import { accessDatabase } from '@/services/accessApi';

export interface Expense {
    id: string;
    date: string;
    description: string;
    category: string;
    amount: number;
    paymentMethod: string;
    createdBy: string;
    createdAt?: string;
}

interface DailyExpensesStore {
    expenses: Expense[];
    loading: boolean;
    fetchExpenses: () => Promise<void>;
    addExpense: (expense: Omit<Expense, 'createdAt'>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;
}

export const useDailyExpenses = create<DailyExpensesStore>((set, get) => ({
    expenses: [],
    loading: false,

    fetchExpenses: async () => {
        set({ loading: true });
        try {
            const data = await accessDatabase.dailyExpenses.getAll();

            const mappedData = data.map((item: any) => ({
                id: item.ID,
                date: item.Date,
                description: item.Description,
                category: item.Category,
                amount: parseFloat(item.Amount),
                paymentMethod: item.PaymentMethod,
                createdBy: item.CreatedBy,
                createdAt: item.CreatedAt
            }));

            set({ expenses: mappedData });
        } catch (error) {
            console.error('Error fetching expenses:', error);
            // toast.error is already handled in apiCall, but we can add more context if needed
        } finally {
            set({ loading: false });
        }
    },

    addExpense: async (expense) => {
        try {
            await accessDatabase.dailyExpenses.create(expense);
            toast.success('Expense added successfully');
            get().fetchExpenses();
        } catch (error) {
            console.error('Error adding expense:', error);
        }
    },

    deleteExpense: async (id) => {
        try {
            await accessDatabase.dailyExpenses.delete(id);
            toast.success('Expense deleted');
            get().fetchExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    },
}));
