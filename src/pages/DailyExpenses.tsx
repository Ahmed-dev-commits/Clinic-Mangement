import { useState, useEffect } from 'react';
import { useDailyExpenses } from '@/hooks/useDailyExpenses';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Search, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { format, parseISO, isSameMonth, isSameDay } from 'date-fns';


const CATEGORIES = [
    'Supplies',
    'Utilities',
    'Maintenance',
    'Salary',
    'Equipment',
    'Marketing',
    'Refunds',
    'Other'
];

const PAYMENT_METHODS = [
    'Cash'
];

export function DailyExpensesPage() {
    const { expenses, loading, fetchExpenses, addExpense, deleteExpense } = useDailyExpenses();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().slice(0, 10),
        description: '',
        category: '',
        amount: '',
        paymentMethod: 'Cash',
    });

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    const handleAddExpense = async () => {
        if (!formData.description || !formData.amount || !formData.category) return;

        await addExpense({
            id: `EXP-${Date.now()}`,
            date: formData.date,
            description: formData.description,
            category: formData.category,
            amount: parseFloat(formData.amount),
            paymentMethod: formData.paymentMethod,
            createdBy: 'Admin', // In real app, get from auth context
        });

        setIsAddDialogOpen(false);
        setFormData({
            date: new Date().toISOString().slice(0, 10),
            description: '',
            category: '',
            amount: '',
            paymentMethod: 'Cash',
        });
    };

    // Filter expenses
    const filteredExpenses = expenses.filter(exp => {
        const matchesSearch =
            exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            exp.category.toLowerCase().includes(searchQuery.toLowerCase());

        // Filter by selected month
        const expDate = parseISO(exp.date);
        const matchesMonth = exp.date.startsWith(selectedMonth);

        return matchesSearch && matchesMonth;
    });

    // Calculations
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Group by category for stats
    const categoryStats = filteredExpenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Daily Expenses"
                description="Track and manage clinic daily expenditures"
            />

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Expenses ({format(parseISO(selectedMonth + '-01'), 'MMMM yyyy')})</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rs {totalExpenses.toLocaleString()}</div>
                    </CardContent>
                </Card>

                {/* Top Category */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Highest Category</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {Object.entries(categoryStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Rs {Object.entries(categoryStats).sort((a, b) => b[1] - a[1])[0]?.[1]?.toLocaleString() || 0}
                        </p>
                    </CardContent>
                </Card>

                {/* Expense Count */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredExpenses.length}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle>Expense Records</CardTitle>
                            <CardDescription>
                                Manage daily expenses and payments
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-40"
                            />
                            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Expense
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add New Expense</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Date</Label>
                                                <Input
                                                    type="date"
                                                    value={formData.date}
                                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Amount (Rs)</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={formData.amount}
                                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Description</Label>
                                            <Input
                                                placeholder="Expense details..."
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Category</Label>
                                                <Select
                                                    value={formData.category}
                                                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {CATEGORIES.map(cat => (
                                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Payment Method</Label>
                                                <Select
                                                    value={formData.paymentMethod}
                                                    onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Method" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {PAYMENT_METHODS.map(method => (
                                                            <SelectItem key={method} value={method}>{method}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <Button className="w-full mt-4" onClick={handleAddExpense}>
                                            Save Expense
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search expenses..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead>Added By</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            Loading expenses...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredExpenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No expenses found for this month
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredExpenses.map((expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell>{format(parseISO(expense.date), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="font-medium">{expense.description}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{expense.category}</Badge>
                                            </TableCell>
                                            <TableCell>{expense.paymentMethod}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{expense.createdBy}</TableCell>
                                            <TableCell className="text-right font-bold">
                                                Rs {expense.amount.toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => deleteExpense(expense.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
