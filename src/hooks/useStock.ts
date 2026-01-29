import { useState, useEffect, useCallback } from 'react';
import { stockApi, StockDTO } from '@/services/accessApi';
import { supabaseStockApi, StockRow } from '@/services/supabaseApi';
import { isCloudEnvironment } from '@/lib/environment';
import { StockItem } from '@/types/hospital';

// Get demo stock from localStorage
function getDemoStock(): StockItem[] {
  try {
    const stored = localStorage.getItem('demo-stock');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.log('Failed to parse demo stock');
  }
  // Default demo stock items
  return [
    { id: 'STK-001', name: 'Paracetamol 500mg', category: 'Tablet', quantity: 500, price: 10, lowStockThreshold: 50, createdAt: new Date().toISOString() },
    { id: 'STK-002', name: 'Amoxicillin 250mg', category: 'Capsule', quantity: 200, price: 25, lowStockThreshold: 30, createdAt: new Date().toISOString() },
    { id: 'STK-003', name: 'Cough Syrup', category: 'Syrup', quantity: 15, price: 150, lowStockThreshold: 20, createdAt: new Date().toISOString() },
  ];
}

// Save demo stock to localStorage
function saveDemoStock(stock: StockItem[]) {
  localStorage.setItem('demo-stock', JSON.stringify(stock));
}

// Convert API DTO to local type
function dtoToStock(dto: StockDTO): StockItem {
  return {
    id: dto.ID,
    name: dto.Name,
    category: dto.Category,
    quantity: dto.Quantity,
    price: dto.Price,
    lowStockThreshold: dto.LowStockThreshold,
    createdAt: dto.CreatedAt,
  };
}

// Convert Supabase row to local type
function rowToStock(row: StockRow): StockItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category || 'Other',
    quantity: row.quantity || 0,
    price: row.price || 0,
    lowStockThreshold: row.low_stock_threshold || 10,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

// Generate unique ID
const generateId = (prefix: string) => {
  const num = Math.floor(Math.random() * 9000) + 1000;
  const suffix = Math.random().toString(36).substr(2, 3).toUpperCase();
  return `${prefix}-${num}${suffix}`;
};

export function useStock() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isCloud, setIsCloud] = useState(false);

  const fetchStock = useCallback(async () => {
    try {
      setLoading(true);
      
      if (isCloudEnvironment()) {
        setIsCloud(true);
        const data = await supabaseStockApi.getAll();
        setStock(data.map(rowToStock));
        setIsDemoMode(false);
      } else {
        setIsCloud(false);
        try {
          const data = await stockApi.getAll();
          setStock(data.map(dtoToStock));
          setIsDemoMode(false);
        } catch {
          console.log('Backend unavailable, using demo mode for stock');
          setStock(getDemoStock());
          setIsDemoMode(true);
        }
      }
    } catch (err) {
      console.error('Error fetching stock:', err);
      setStock(getDemoStock());
      setIsDemoMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const addStockItem = async (itemData: Omit<StockItem, 'id' | 'createdAt'>) => {
    const id = generateId('STK');
    
    if (isCloud) {
      await supabaseStockApi.create({
        id,
        name: itemData.name,
        category: itemData.category,
        quantity: itemData.quantity,
        price: itemData.price,
        low_stock_threshold: itemData.lowStockThreshold,
      });
      await fetchStock();
      return id;
    }

    if (isDemoMode) {
      const newItem: StockItem = { ...itemData, id, createdAt: new Date().toISOString() };
      const updated = [...stock, newItem];
      setStock(updated);
      saveDemoStock(updated);
      return id;
    }

    try {
      await stockApi.create({
        ID: id,
        Name: itemData.name,
        Category: itemData.category,
        Quantity: itemData.quantity,
        Price: itemData.price,
        LowStockThreshold: itemData.lowStockThreshold,
      });
      await fetchStock();
      return id;
    } catch {
      const newItem: StockItem = { ...itemData, id, createdAt: new Date().toISOString() };
      const updated = [...stock, newItem];
      setStock(updated);
      saveDemoStock(updated);
      setIsDemoMode(true);
      return id;
    }
  };

  const updateStockItem = async (id: string, itemData: Partial<StockItem>) => {
    if (isCloud) {
      await supabaseStockApi.update(id, {
        name: itemData.name,
        category: itemData.category,
        quantity: itemData.quantity,
        price: itemData.price,
        low_stock_threshold: itemData.lowStockThreshold,
      });
      await fetchStock();
      return;
    }

    if (isDemoMode) {
      const updated = stock.map(s => s.id === id ? { ...s, ...itemData } : s);
      setStock(updated);
      saveDemoStock(updated);
      return;
    }

    try {
      await stockApi.update(id, {
        Name: itemData.name,
        Category: itemData.category,
        Quantity: itemData.quantity,
        Price: itemData.price,
        LowStockThreshold: itemData.lowStockThreshold,
      });
      await fetchStock();
    } catch {
      const updated = stock.map(s => s.id === id ? { ...s, ...itemData } : s);
      setStock(updated);
      saveDemoStock(updated);
      setIsDemoMode(true);
    }
  };

  const deleteStockItem = async (id: string) => {
    if (isCloud) {
      await supabaseStockApi.delete(id);
      await fetchStock();
      return;
    }

    if (isDemoMode) {
      const updated = stock.filter(s => s.id !== id);
      setStock(updated);
      saveDemoStock(updated);
      return;
    }

    try {
      await stockApi.delete(id);
      await fetchStock();
    } catch {
      const updated = stock.filter(s => s.id !== id);
      setStock(updated);
      saveDemoStock(updated);
      setIsDemoMode(true);
    }
  };

  const reduceStock = async (itemId: string, quantity: number) => {
    const item = stock.find(s => s.id === itemId);
    if (!item) return;
    
    const newQuantity = Math.max(0, item.quantity - quantity);
    await updateStockItem(itemId, { quantity: newQuantity });
  };

  const getLowStockItems = () => stock.filter(s => s.quantity <= s.lowStockThreshold);

  return {
    stock,
    loading,
    isDemoMode,
    isCloud,
    addStockItem,
    updateStockItem,
    deleteStockItem,
    reduceStock,
    getLowStockItems,
    refetch: fetchStock,
  };
}
