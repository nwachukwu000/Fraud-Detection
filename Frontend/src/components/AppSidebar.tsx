import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, LayoutDashboard, CreditCard, AlertTriangle, FolderKanban, BarChart3, FileText, Activity, Settings, Users, User as UserIcon, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { User as UserType, alertsApi, casesApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transaction Monitoring", url: "/transactions", icon: CreditCard },
  { title: "Alerts", url: "/alerts", icon: AlertTriangle },
  { title: "Case Management", url: "/cases", icon: FolderKanban },
  { title: "Reports & Analytics", url: "/reports", icon: BarChart3 },
  { title: "Custom Reports", url: "/custom-reports", icon: FileText },
  { title: "Behavioral Analytics", url: "/behavioral-analytics", icon: Activity },
  { title: "Rules Engine", url: "/rules-engine", icon: Settings },
  { title: "User & Role Management", url: "/user-management", icon: Users },
];

export function AppSidebar() {
  const navigate = useNavigate();

  // Get logged-in user from localStorage
  const currentUser = useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        return JSON.parse(userStr) as UserType;
      }
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
    }
    return null;
  }, []);

  // Get user initials for avatar
  const userInitials = useMemo(() => {
    if (currentUser?.fullName) {
      return currentUser.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return "U";
  }, [currentUser]);

  // Fetch alerts and cases to calculate count of alerts without cases
  const { data: alertsData } = useQuery({
    queryKey: ["sidebar-alerts"],
    queryFn: () => alertsApi.getList({ page: 1, pageSize: 10000 }),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: casesData } = useQuery({
    queryKey: ["sidebar-cases"],
    queryFn: () => casesApi.getList({ page: 1, pageSize: 10000 }),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Calculate count of transactions with alerts but no case
  const alertsWithoutCaseCount = useMemo(() => {
    const alerts = alertsData?.items || [];
    const cases = casesData?.items || [];
    const caseTransactionIds = new Set(cases.map(c => c.transactionId));
    return alerts.filter(alert => !caseTransactionIds.has(alert.id)).length;
  }, [alertsData, casesData]);

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-yellow-500">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-sidebar-foreground">FraudGuard</h2>
            <p className="text-xs text-sidebar-foreground/70">Fraud Detection</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-2 ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {item.title === "Alerts" && alertsWithoutCaseCount > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="h-5 min-w-5 px-1.5 text-xs"
                        >
                          {alertsWithoutCaseCount > 99 ? "99+" : alertsWithoutCaseCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-sm text-primary-foreground">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-semibold text-sidebar-foreground">
              {currentUser?.fullName || "User"}
            </p>
            <p className="text-xs text-sidebar-foreground/70">
              {currentUser?.role || "Unknown"}
            </p>
          </div>
        </div>
        <Separator className="mb-2" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink 
                to="/profile-settings"
                className={({ isActive }) =>
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }
              >
                <UserIcon className="h-4 w-4" />
                <span>Profile & Settings</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/auth");
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
