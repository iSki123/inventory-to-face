import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-semibold">Salesonator</h1>
                <p className="text-sm text-muted-foreground">
                  Dealership Automation Platform
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {profile && (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {profile.first_name} {profile.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {profile.dealership_name || 'No dealership'}
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {profile.role.replace('_', ' ')}
                  </Badge>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Credits</p>
                    <p className="text-sm font-medium">{profile.credits}</p>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}