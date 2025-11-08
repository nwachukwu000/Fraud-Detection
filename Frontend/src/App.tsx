import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import TransactionDetails from "./pages/TransactionDetails";
import Alerts from "./pages/Alerts";
import Cases from "./pages/Cases";
import Reports from "./pages/Reports";
import CustomReports from "./pages/CustomReports";
import BehavioralAnalytics from "./pages/BehavioralAnalytics";
import RulesEngine from "./pages/RulesEngine";
import UserManagement from "./pages/UserManagement";
import ProfileSettings from "./pages/ProfileSettings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/transactions/:id" element={<TransactionDetails />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/custom-reports" element={<CustomReports />} />
          <Route path="/behavioral-analytics" element={<BehavioralAnalytics />} />
          <Route path="/rules-engine" element={<RulesEngine />} />
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="/profile-settings" element={<ProfileSettings />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
