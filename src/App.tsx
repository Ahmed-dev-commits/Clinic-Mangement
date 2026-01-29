import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardPage } from "./pages/Dashboard";
import { PatientsPage } from "./pages/Patients";
import { FeesPage } from "./pages/Fees";
import { StockPage } from "./pages/Stock";
import { MedicinesPage } from "./pages/Medicines";
import { PrescriptionsPage } from "./pages/Prescriptions";
import { LabResultsPage } from "./pages/LabResults";
import { UsersPage } from "./pages/Users";
import { SettingsPage } from "./pages/Settings";
import { DailyExpensesPage } from "./pages/DailyExpenses";
import { LoginPage } from "./pages/Login";
import { UnauthorizedPage } from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
import { useSettingsStore } from "./store/settingsStore";
import { applyTheme } from "./lib/themes";
import { useEffect } from "react";

const App = () => {
  const { settings } = useSettingsStore();

  useEffect(() => {
    if (settings.themeColor) {
      applyTheme(settings.themeColor);
    }
  }, [settings.themeColor]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <GlobalErrorBoundary>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Protected routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Routes>
                        {/* Dashboard - All roles */}
                        <Route path="/" element={<DashboardPage />} />

                        {/* Patients - Receptionist, Doctor */}
                        <Route
                          path="/patients"
                          element={
                            <ProtectedRoute allowedRoles={['Receptionist', 'Doctor', 'Admin']}>
                              <PatientsPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Fees - Receptionist */}
                        <Route
                          path="/fees"
                          element={
                            <ProtectedRoute allowedRoles={['Receptionist', 'Admin']}>
                              <FeesPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Pharmacy - Receptionist only */}
                        <Route
                          path="/stock"
                          element={
                            <ProtectedRoute allowedRoles={['Receptionist', 'Admin']}>
                              <StockPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Medicines - Doctor only */}
                        <Route
                          path="/medicines"
                          element={
                            <ProtectedRoute allowedRoles={['Doctor', 'Admin']}>
                              <MedicinesPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Prescriptions - Doctor */}
                        <Route
                          path="/prescriptions"
                          element={
                            <ProtectedRoute allowedRoles={['Doctor', 'Admin']}>
                              <PrescriptionsPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Lab Results - Lab Technician only */}
                        <Route
                          path="/lab-results"
                          element={
                            <ProtectedRoute allowedRoles={['LabTechnician', 'Admin']}>
                              <LabResultsPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Users - Admin only */}
                        <Route
                          path="/users"
                          element={
                            <ProtectedRoute allowedRoles={['Admin']}>
                              <UsersPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Daily Expenses - Admin & Receptionist */}
                        <Route
                          path="/daily-expenses"
                          element={
                            <ProtectedRoute allowedRoles={['Admin', 'Receptionist']}>
                              <DailyExpensesPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Settings - Admin only */}
                        <Route
                          path="/settings"
                          element={
                            <ProtectedRoute allowedRoles={['Admin', 'Doctor', 'Receptionist']}>
                              <SettingsPage />
                            </ProtectedRoute>
                          }
                        />

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </GlobalErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
