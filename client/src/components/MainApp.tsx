import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import CampaignManagement from "@/pages/CampaignManagement";
import NewCampaign from "@/pages/NewCampaign";
import SettingsModal from "./SettingsModal";
import OnboardingWizard from "./OnboardingWizard";
import { logout } from "@/lib/auth";
import { Link, Settings, User, LogOut } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

interface MainAppProps {
  user: UserType;
  onLogout: () => void;
}

export default function MainApp({ user, onLogout }: MainAppProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentPage, setCurrentPage] = useState<'management' | 'new-campaign'>('management');

  // Check if user has any source templates
  const { data: sourceTemplates = [], isLoading } = useQuery({
    queryKey: ["/api/source-templates"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/source-templates");
      return response.json();
    },
  });

  // Show onboarding if user has no source templates and hasn't dismissed it
  const shouldShowOnboarding = !isLoading && sourceTemplates.length === 0 && !showOnboarding;

  const handleLogout = async () => {
    try {
      await logout();
      onLogout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="bg-surface shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center mr-3">
                <Link className="text-white" size={16} />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">UTM Builder</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="text-gray-500 hover:text-gray-700"
              >
                <Settings size={18} />
              </Button>
              <div className="flex items-center text-sm text-gray-600">
                <User className="mr-2" size={16} />
                <span>{user.email}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700"
              >
                <LogOut size={18} />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentPage === 'management' ? (
          <CampaignManagement
            user={user}
            onNewCampaign={() => setCurrentPage('new-campaign')}
          />
        ) : (
          <NewCampaign
            user={user}
            onBackToManagement={() => setCurrentPage('management')}
          />
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
      />

      {/* Onboarding Wizard */}
      <OnboardingWizard
        isOpen={shouldShowOnboarding}
        onClose={() => setShowOnboarding(true)}
        user={user}
      />
    </div>
  );
}
