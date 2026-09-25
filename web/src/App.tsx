import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute, OwnerRoute, GuestOnlyRoute } from "./components/RouteGuards";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ContactsImportPage } from "./pages/ContactsImportPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { CampaignDetailPage } from "./pages/CampaignDetailPage";
import { ConversationsActivePage } from "./pages/ConversationsActivePage";
import { ConversationsWaitingPage } from "./pages/ConversationsWaitingPage";
import { ConversationDetailPage } from "./pages/ConversationDetailPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminApiKeysPage } from "./pages/AdminApiKeysPage";
import { AdminActivityPage } from "./pages/AdminActivityPage";

export default function App() {
  return (
    <BrowserRouter basename="/app">
      <AuthProvider>
        <Routes>
          <Route element={<GuestOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/contacts" element={<ContactsImportPage />} />
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
              <Route path="/conversations/active" element={<ConversationsActivePage />} />
              <Route path="/conversations/waiting" element={<ConversationsWaitingPage />} />
              <Route path="/conversations/:id" element={<ConversationDetailPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/api-keys" element={<ApiKeysPage />} />

              <Route element={<OwnerRoute />}>
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/api-keys" element={<AdminApiKeysPage />} />
                <Route path="/admin/activity" element={<AdminActivityPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
