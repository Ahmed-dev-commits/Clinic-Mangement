import { useState } from 'react';
import { useClinicalMedicines, ClinicalMedicine } from '@/hooks/useClinicalMedicines';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Pill, RefreshCw, Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { toast } from 'sonner';

const CATEGORIES = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Liquid', 'Cream', 'Supplies', 'Equipment', 'Other'];

export function MedicinesPage() {
  const { medicines, loading, refetch, addMedicine, updateMedicine, deleteMedicine } = useClinicalMedicines();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState<ClinicalMedicine | null>(null);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClinicalMedicine | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Tablet',
  });

  // Filter medicines
  const filteredMedicines = medicines.filter((item) => {
    return searchQuery.length < 3 ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Show hint when typing less than 3 characters
  const showSearchHint = searchQuery.length > 0 && searchQuery.length < 3;

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Tablet',
    });
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: ClinicalMedicine) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category || 'Tablet',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Please enter medicine name');
      return;
    }

    // Default values for fields not in the simplified form
    const itemData = {
      name: formData.name.trim(),
      category: formData.category,
      dosage: '', // Default empty
      frequency: '', // Default empty
      duration: '', // Default empty
    };

    try {
      if (editingItem) {
        await updateMedicine(editingItem.id, itemData);
        toast.success('Medicine updated successfully');
      } else {
        await addMedicine(itemData);
        toast.success('Medicine added successfully');
      }
      handleCloseDialog();
    } catch (err) {
      toast.error('Failed to save medicine');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this medicine?')) {
      await deleteMedicine(id);
      toast.success('Medicine deleted from master list');
      if (selectedMedicine?.id === id) setSelectedMedicine(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Clinical Medicines"
        description="Manage the master list of medicines for prescriptions"
        action={
          <div className="flex items-center gap-3">
            <ConnectionStatus />
            <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Clinical Medicine
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clinical Medicines</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{medicines.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search medicine (type 3+ characters)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>
      </div>

      {/* Search hint */}
      {showSearchHint && (
        <p className="text-sm text-muted-foreground mb-4">
          Type {3 - searchQuery.length} more character{3 - searchQuery.length !== 1 ? 's' : ''} to search...
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Medicines Table */}
        <div className="lg:col-span-2">
          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredMedicines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      {searchQuery.length >= 3
                        ? `No medicines found for "${searchQuery}"`
                        : 'No medicines available'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMedicines.map((item) => {
                    const isSelected = selectedMedicine?.id === item.id;
                    return (
                      <TableRow
                        key={item.id}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                        onClick={() => setSelectedMedicine(item)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Pill className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="font-medium">{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDialog(item);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Medicine Details Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Medicine Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedMedicine ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Pill className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{selectedMedicine.name}</h3>
                      <Badge variant="outline">{selectedMedicine.category}</Badge>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => handleOpenDialog(selectedMedicine)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Pill className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a medicine to view details</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Add/Edit Medicine Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Medicine' : 'Add Clinical Medicine'}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Update medicine details.'
                : 'Add a new medicine to the master clinical list.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Medicine Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Paracetamol"
              />
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category} // Use category from state
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingItem ? 'Update' : 'Add Medicine'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
