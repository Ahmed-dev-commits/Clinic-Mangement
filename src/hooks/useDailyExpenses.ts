import { create } from 'zustand';
import { toast } from 'sonner';

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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const useDailyExpenses = create<DailyExpensesStore>((set, get) => ({
    expenses: [],
    loading: false,

    fetchExpenses: async () => {
        set({ loading: true });
        try {
            const response = await fetch(`${API_URL}/daily-expenses`);
            if (!response.ok) throw new Error('Failed to fetch expenses');
            const data = await response.json();

            // Transform keys to camelCase if needed, but backend uses ID, Date etc. upper/mixed?
            // Server `convertRowDates` keeps original keys.
            // My server code: `SELECT * FROM DailyExpenses`.
            // Table cols: `ID`, `Date`, `Description`...
            // So response objects will have `ID`, `Date`...
            // I need to map them to lowercase for frontend consistency or update backend to return lowercase.
            // Backend `res.json(rows.map(convertRowDates))` returns DB column names.

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
            toast.error('Failed to load expenses');
        } finally {
            set({ loading: false });
        }
    },

    addExpense: async (expense) => {
        try {
            const response = await fetch(`${API_URL}/daily-expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expense),
            });

            if (!response.ok) throw new Error('Failed to add expense');

            toast.success('Expense added successfully');
            get().fetchExpenses();
        } catch (error) {
            console.error('Error adding expense:', error);
            toast.error('Failed to add expense');
        }
    },

    deleteExpense: async (id) => {
        try {
            const response = await fetch(`${API_URL}/daily-expenses/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete expense');

            toast.success('Expense deleted');
            get().fetchExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
            toast.error('Failed to delete expense');
        }
    },
}));
