import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import ShopLayout from "@/components/ShopLayout";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import SignupSuccess from "./pages/auth/SignupSuccess";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Shop pages
import DashboardPage from "./pages/shop/Dashboard";
import ProductsPage from "./pages/shop/Products";
import SalesPage from "./pages/shop/Sales";
import NewSalePage from "./pages/shop/NewSale";
import InventoryPage from "./pages/shop/Inventory";
import CustomersPage from "./pages/shop/Customers";
import ReportsPage from "./pages/shop/Reports";
import PurchasesPage from "./pages/shop/Purchases";
import SuppliersPage from "./pages/shop/Suppliers";
import SettingsPage from "./pages/shop/Settings";
// ExcelImport removed - handled in Products bulk add
import TransactionsPage from "./pages/shop/Transactions";
import StaffsPage from "./pages/shop/Staffs";
import SmsEmailPage from "./pages/shop/SmsEmail";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/signup-success" element={<SignupSuccess />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Admin routes */}
              <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />

              {/* Shop routes - all protected */}
              <Route element={<ProtectedRoute><ShopLayout /></ProtectedRoute>}>
                <Route index element={<DashboardPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="new-sale" element={<NewSalePage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="purchases" element={<PurchasesPage />} />
                <Route path="sales" element={<SalesPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="suppliers" element={<SuppliersPage />} />
                <Route path="staffs" element={<StaffsPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="sms-email" element={<SmsEmailPage />} />
                {/* Excel import removed - handled in Products bulk add */}
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
