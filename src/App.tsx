import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Leads from "./pages/Leads";
import Billing from "./pages/Billing";
import Community from "./pages/Community";
import UserManagement from "./pages/UserManagement";
import Analytics from "./pages/Analytics";
import AdminPanel from "./pages/AdminPanel";
import ChatModerationPanel from "./pages/ChatModerationPanel";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      {user ? (
        <>
          <Route path="/" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
          <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
          <Route path="/inventory" element={<DashboardLayout><Inventory /></DashboardLayout>} />
          <Route path="/leads" element={<DashboardLayout><Leads /></DashboardLayout>} />
          <Route path="/billing" element={<DashboardLayout><Billing /></DashboardLayout>} />
          <Route path="/community" element={<DashboardLayout><Community /></DashboardLayout>} />
          <Route path="/users" element={<DashboardLayout><UserManagement /></DashboardLayout>} />
          <Route path="/analytics" element={<DashboardLayout><Analytics /></DashboardLayout>} />
          <Route path="/admin" element={<DashboardLayout><AdminPanel /></DashboardLayout>} />
          <Route path="/chat-moderation" element={<DashboardLayout><ChatModerationPanel /></DashboardLayout>} />
          <Route path="/settings" element={<DashboardLayout><Settings /></DashboardLayout>} />
        </>
      ) : (
        <Route path="/" element={<Index />} />
      )}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
