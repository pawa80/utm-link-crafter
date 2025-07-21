import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VendorAuthProvider, useVendorAuth } from "@/contexts/VendorAuthContext";
import VendorAuth from "@/pages/VendorAuth";
import VendorDashboard from "@/pages/VendorDashboard";
import VendorAccounts from "@/pages/VendorAccounts";
import VendorTemplates from "@/pages/VendorTemplates";
import VendorAnalytics from "@/pages/VendorAnalytics";

function VendorRouter() {
  const { vendorUser, isInitializing } = useVendorAuth();

  // Show loading spinner while checking authentication
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-700">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          Loading platform...
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!vendorUser) {
    return <VendorAuth />;
  }

  // Show vendor admin interface if authenticated
  return (
    <Switch>
      <Route path="/vendor-admin-38291" component={VendorDashboard} />
      <Route path="/platform-control" component={VendorDashboard} />
      <Route path="/platform-control/accounts" component={VendorAccounts} />
      <Route path="/platform-control/templates" component={VendorTemplates} />
      <Route path="/platform-control/analytics" component={VendorAnalytics} />
      <Route component={VendorDashboard} />
    </Switch>
  );
}

function VendorApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <VendorAuthProvider>
          <Toaster />
          <VendorRouter />
        </VendorAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default VendorApp;