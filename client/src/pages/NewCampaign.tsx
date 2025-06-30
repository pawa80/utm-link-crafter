import { Button } from "@/components/ui/button";
import CampaignWizard from "@/components/CampaignWizard";
import { ArrowLeft } from "lucide-react";
import type { User } from "@shared/schema";

interface NewCampaignProps {
  user: User;
  onBackToManagement: () => void;
}

export default function NewCampaign({ user, onBackToManagement }: NewCampaignProps) {
  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onBackToManagement}
          className="text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Campaign Management
        </Button>
        <div className="text-center flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Create New Campaign</h1>
          <p className="text-gray-600">Build and save your UTM campaign links</p>
        </div>
        <div className="w-32"></div> {/* Spacer for centering */}
      </div>

      {/* Campaign Wizard */}
      <CampaignWizard user={user} onSaveSuccess={onBackToManagement} />
    </div>
  );
}