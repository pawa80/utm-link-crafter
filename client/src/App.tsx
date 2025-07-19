import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePage from "@/pages/HomePage";
import Dashboard from "@/pages/Dashboard";
import CampaignManagement from "@/pages/CampaignManagement";
import NewCampaign from "@/pages/NewCampaign";
import TemplateManagement from "@/pages/TemplateManagement";
import Settings from "@/pages/Settings";
import TagManagement from "@/pages/TagManagement";
import AccountManagement from "@/pages/AccountManagement";
import AcceptInvitation from "@/pages/AcceptInvitation";
import ChatWizardPage from "@/pages/ChatWizardPage";
import NotFound from "@/pages/NotFound";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/campaigns" component={CampaignManagement} />
      <Route path="/new-campaign" component={NewCampaign} />
      <Route path="/chat-wizard" component={ChatWizardPage} />
      <Route path="/template-management" component={TemplateManagement} />
      <Route path="/settings" component={Settings} />
      <Route path="/tags" component={TagManagement} />
      <Route path="/account-management" component={AccountManagement} />
      <Route path="/accept-invitation/:token" component={AcceptInvitation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
