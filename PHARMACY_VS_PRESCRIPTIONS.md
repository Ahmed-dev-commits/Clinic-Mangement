# Pharmacy vs Prescription Medicines - System Architecture

## 🏥 Two Separate Systems

### 1. **Pharmacy (Medicine Stock)** 📦
**Purpose**: Inventory and stock management  
**Table**: `MedicineStock`  
**Users**: Pharmacy staff, administrators  
**Function**: Record keeping of available medicines

#### Features:
- Add/Edit/Delete medicines in inventory
- Track stock quantities
- Monitor expiry dates
- Manage suppliers
- Generate stock reports

#### Database Table:
```sql
MedicineStock (
  ID VARCHAR(50) PRIMARY KEY,
  Name VARCHAR(255),
  Category VARCHAR(100),
  Quantity INT,
  Unit VARCHAR(50),
  ExpiryDate DATE,
  Supplier VARCHAR(255),
  PurchasePrice DECIMAL(10,2),
  SellingPrice DECIMAL(10,2),
  CreatedAt DATETIME
)
```

---

### 2. **Prescription Medicines** 💊
**Purpose**: Clinical records of prescribed medicines  
**Table**: `PrescriptionMedicines`  
**Users**: Doctors only  
**Function**: Record what medicines are prescribed to patients

#### Features:
- Doctors prescribe medicines to patients
- Track dosage, frequency, duration
- Part of patient's medical record
- Generate prescription PDFs
- Maintain prescription history

#### Database Table:
```sql
PrescriptionMedicines (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  PrescriptionID VARCHAR(50) NOT NULL,
  MedicineName VARCHAR(255) NOT NULL,
  Dosage VARCHAR(50),
  Frequency VARCHAR(100),
  Duration VARCHAR(50),
  Quantity INT DEFAULT 1,
  FOREIGN KEY (PrescriptionID) REFERENCES Prescriptions(ID) ON DELETE CASCADE
)
```

---

## 🔑 Key Differences

| Aspect | Pharmacy (Stock) | Prescription Medicines |
|--------|-----------------|----------------------|
| **Purpose** | Inventory management | Clinical records |
| **Users** | Pharmacy staff | Doctors |
| **Data Type** | Stock items | Prescribed items |
| **Linked To** | Suppliers, purchases | Patients, prescriptions |
| **Updates** | Stock levels change | Historical record (immutable) |
| **Foreign Keys** | None | Links to Prescriptions table |

---

## 🔄 How They Work Together (Optional)

While these systems are **separate**, you can optionally:

1. **Display pharmacy stock** when doctor is prescribing
   - Show available medicines from `MedicineStock`
   - Help doctor see what's in stock
   - But doctor can prescribe ANY medicine (not limited to stock)

2. **Track stock usage** (if desired)
   - When prescription is finalized, optionally reduce stock
   - This is a business logic choice, not a database constraint
   - Can be implemented in the future

---

## ✅ Current Implementation

### Backend (Completed)

1. **PrescriptionMedicines Table**
   - ✅ Created without link to MedicineStock
   - ✅ Only stores clinical prescription data
   - ✅ Linked to Prescriptions via foreign key

2. **API Endpoints**
   - ✅ GET `/api/prescriptions` - Fetches prescriptions with medicines
   - ✅ POST `/api/prescriptions` - Creates prescription with medicines
   - ✅ PUT `/api/prescriptions/:id` - Updates prescription medicines

3. **MedicineStock (Pharmacy)**
   - ✅ Separate table for inventory
   - ✅ API endpoints: GET, POST, PUT, DELETE `/api/stock`
   - ✅ No connection to prescriptions

### Frontend

**Pharmacy Section** (Already exists):
- Located in: Stock/Inventory management page
- Users can add/edit medicines
- Track quantities and expiry dates

**Prescription Section** (Current):
- Located in: Prescriptions page
- Doctors manually enter medicine names
- No link to pharmacy stock
- Generates PDFs with prescribed medicines

---

## 📊 Data Flow

### Pharmacy Flow:
```
Pharmacy Staff → Add Medicine → MedicineStock Table → Inventory Reports
```

### Prescription Flow:
```
Doctor → Create Prescription → Enter Medicines → PrescriptionMedicines Table → Patient Record
```

### No Direct Connection:
```
MedicineStock ❌ PrescriptionMedicines
(Separate systems for different purposes)
```

---

## 🎯 Benefits of Separation

1. **Flexibility**: Doctor can prescribe any medicine, not limited to stock
2. **Independence**: Pharmacy stock issues don't affect prescriptions
3. **Clarity**: Clear separation of inventory vs clinical records
4. **Compliance**: Medical records separate from business records
5. **Scalability**: Each system can evolve independently

---

## 🚀 Future Enhancements (Optional)

If you want to connect them in the future:

1. **Stock Suggestions**
   - Show pharmacy stock when doctor types medicine name
   - Autocomplete from available stock
   - But allow custom entries too

2. **Stock Alerts**
   - Warn if prescribed medicine is out of stock
   - Suggest alternatives from stock

3. **Automatic Stock Reduction**
   - When prescription is finalized, reduce stock
   - Track which prescriptions affected stock

4. **Reports**
   - Most prescribed medicines
   - Stock usage vs prescriptions
   - Inventory turnover

---

## 📝 Summary

✅ **Pharmacy (MedicineStock)**: For inventory management  
✅ **Prescriptions (PrescriptionMedicines)**: For clinical records  
✅ **Separate Tables**: No foreign key relationship  
✅ **Independent Systems**: Can work without each other  
✅ **Backend Complete**: All APIs working correctly  

The system is now properly structured with clear separation between pharmacy inventory and clinical prescription records!
