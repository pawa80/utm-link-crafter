import { Link } from "wouter";
import { Zap } from "lucide-react";

export default function Logo() {
  return (
    <Link href="/">
      <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity duration-200">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
          <Zap size={20} className="text-white" />
        </div>
        <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          UTM Builder
        </span>
      </div>
    </Link>
  );
}