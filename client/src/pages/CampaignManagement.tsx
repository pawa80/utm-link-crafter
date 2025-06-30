import { Button } from "@/components/ui/button";
import GeneratedLinks from "@/components/GeneratedLinks";
import { Plus } from "lucide-react";
import type { User } from "@shared/schema";

interface CampaignManagementProps {
  user: User;
  onNewCampaign: () => void;
}

export default function CampaignManagement({ user, onNewCampaign }: CampaignManagementProps) {
  return (
    <div className="space-y-6">
      {/* Header with New Campaign button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Management</h1>
          <p className="text-gray-600">View and manage your UTM campaigns</p>
        </div>
        <Button
          onClick={onNewCampaign}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Generated Links Section */}
      <GeneratedLinks />
    </div>
  );
}