import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Database, Globe, LayoutDashboard, Link2, LogOut, Mail, Settings, Users,
  Building2, Briefcase, CreditCard, Key, Webhook, Shield, BarChart3, Activity,
  Calendar, Zap, Workflow, Sparkles, Bell, Plug,
  TrendingUp, Search, Package, FileText as QuoteIcon, BookOpen, TrendingUp as AnalyticsIcon,
  UsersRound, Map, Target, DollarSign, Phone, FolderOpen, FileSignature,
  MessageCircle, Ticket, Megaphone, Heart, Brain, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import "./sidebar.css";

const NAV = [
  { name: "Admin Portal", icon: Shield, path: "/admin-dashboard", adminOnly: true },
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { name: "Insights", icon: BarChart3, path: "/insights" },
  { name: "Leads", icon: Briefcase, path: "/leads" },
  { name: "Deals", icon: TrendingUp, path: "/deals" },
  { name: "Quotes", icon: QuoteIcon, path: "/quotes" },
  { name: "Products", icon: Package, path: "/products" },
  { name: "Playbooks", icon: BookOpen, path: "/playbooks" },
  { name: "Analytics", icon: AnalyticsIcon, path: "/analytics" },
  { name: "Activities", icon: Activity, path: "/activities" },
  { name: "Calendar", icon: Calendar, path: "/calendar" },
  { name: "Organizations", icon: Building2, path: "/organizations" },
  { name: "Contacts", icon: UsersRound, path: "/contacts" },
  { name: "Territories", icon: Map, path: "/territories" },
  { name: "Sales", icon: null, children: [
    { name: "Quotas", icon: Target, path: "/quotas" },
    { name: "Commissions", icon: DollarSign, path: "/commissions" },
  ]},
  { name: "Calls", icon: Phone, path: "/calls" },
  { name: "Documents", icon: FolderOpen, path: "/documents" },
  { name: "Contracts", icon: FileSignature, path: "/contracts" },
  { name: "Searches", icon: Search, path: null, children: [
    { name: "Email", icon: Mail, path: "/tools/email" },
    { name: "Domain", icon: Globe, path: "/tools/domain" },
    { name: "Database", icon: Database, path: "/tools/database" },
    { name: "Social URL", icon: Link2, path: "/tools/url" },
  ]},
  { name: "Automation", icon: null, children: [
    { name: "Sequences", icon: Workflow, path: "/sequences" },
    { name: "Workflows", icon: Zap, path: "/workflows" },
    { name: "Templates", icon: Mail, path: "/templates" },
    { name: "Custom fields", icon: Sparkles, path: "/custom-fields" },
  ]},
  { name: "Support", icon: null, children: [
    { name: "Tickets", icon: Ticket, path: "/tickets" },
    { name: "Surveys", icon: MessageCircle, path: "/surveys" },
    { name: "Knowledge base", icon: BookOpen, path: "/kb" },
  ]},
  { name: "Marketing", icon: null, children: [
    { name: "Campaigns", icon: Megaphone, path: "/campaigns" },
    { name: "Health scores", icon: Heart, path: "/health-scores" },
    { name: "AI insights", icon: Brain, path: "/ai-insights" },
  ]},
  { name: "Team", icon: Users, path: "/team" },
  { name: "Billing", icon: CreditCard, path: "/billing" },
  { name: "Developer", icon: null, children: [
    { name: "API keys", icon: Key, path: "/api-keys" },
    { name: "Webhooks", icon: Webhook, path: "/webhooks" },
    { name: "Integrations", icon: Plug, path: "/integrations" },
  ]},
  { name: "Account", icon: null, children: [
    { name: "Usage", icon: Activity, path: "/usage" },
    { name: "Changelog", icon: Sparkles, path: "/changelog" },
    { name: "Notifications", icon: Bell, path: "/notifications-prefs" },
    { name: "Data & privacy", icon: Shield, path: "/data" },
  ]},
  { name: "Audit log", icon: Shield, path: "/audit", adminOnly: true },
  { name: "Settings", icon: Settings, path: "/settings" },
];

const Sidebar = ({ isMobileOpen, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleNavClick = (path) => {
    if (path) {
      navigate(path);
      if (onMobileClose) onMobileClose();
    }
  };

  const userInitial = user?.name?.trim().charAt(0).toUpperCase() || "U";
  const visibleNav = NAV.filter((item) => !item.adminOnly || isAdmin);

  const sidebarContent = (
    <>
      {/* App Branding / Logo Box */}
      <Link to="/dashboard" onClick={() => onMobileClose && onMobileClose()}>
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm transition-colors duration-300 dark:bg-gray-900">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-500 text-lg font-bold text-white shadow-lg shadow-teal-500/30">
            U
          </div>
          {(isExpanded || isMobileOpen) && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                UptoSkills
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                Lead intelligence suite
              </p>
            </div>
          )}
        </div>
      </Link>

      {/* Navigation List */}
      <nav className="flex flex-1 flex-col gap-1">
        {visibleNav.map((item) => {
          if (item.children) {
            return (
              <div key={item.name}>
                <div
                  className={`mt-3 flex w-full items-center rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${
                    isExpanded || isMobileOpen ? "justify-start" : "justify-center"
                  }`}
                >
                  {item.name}
                </div>
                {item.children.map((child) => {
                  const isActive = location.pathname === child.path;
                  return (
                    <button
                      key={child.path}
                      type="button"
                      onClick={() => handleNavClick(child.path)}
                      className={`group relative flex w-full items-center rounded-2xl px-4 py-2 text-sm font-medium transition-colors duration-300 ${
                        isExpanded || isMobileOpen ? "justify-start" : "justify-center"
                      } ${
                        isActive
                          ? "bg-teal-50 text-teal-700 shadow-sm dark:bg-teal-500/10 dark:text-teal-300"
                          : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {child.icon && (
                        <child.icon className={`h-4 w-4 shrink-0 ${isExpanded || isMobileOpen ? "mr-2" : ""}`} />
                      )}
                      {(isExpanded || isMobileOpen) && <span className="truncate">{child.name}</span>}
                    </button>
                  );
                })}
              </div>
            );
          }
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNavClick(item.path)}
              className={`group relative flex w-full items-center rounded-2xl px-4 py-3 text-sm font-medium transition-colors duration-300 ${
                isExpanded || isMobileOpen ? "justify-start" : "justify-center"
              } ${
                isActive
                  ? "bg-teal-50 text-teal-700 shadow-sm dark:bg-teal-500/10 dark:text-teal-300"
                  : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
              title={isExpanded || isMobileOpen ? undefined : item.name}
            >
              {item.icon && <item.icon className={`h-5 w-5 shrink-0 ${isExpanded || isMobileOpen ? "mr-3" : ""}`} />}
              {(isExpanded || isMobileOpen) && <span className="truncate">{item.name}</span>}
              {isActive && (isExpanded || isMobileOpen) && (
                <span className="ml-auto h-2.5 w-2.5 rounded-full bg-teal-500 dark:bg-teal-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer Section */}
      <div className="mt-6 border-t border-gray-200 pt-4 transition-colors duration-300 dark:border-gray-700">
        <Link to="/settings" onClick={() => onMobileClose && onMobileClose()}>
          <div
            className={`mb-3 flex items-center rounded-2xl bg-white px-3 py-3 shadow-sm transition-colors duration-300 dark:bg-gray-900 ${
              isExpanded || isMobileOpen ? "justify-start" : "justify-center"
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
              {userInitial}
            </div>
            {(isExpanded || isMobileOpen) && (
              <div className="ml-3 min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {user?.name || "Account"}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user?.role || "Member"}
                </p>
              </div>
            )}
          </div>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className={`flex w-full items-center rounded-2xl px-3 py-2 text-sm text-gray-600 hover:bg-white hover:text-red-500 dark:text-gray-300 dark:hover:bg-gray-700 ${
            isExpanded || isMobileOpen ? "justify-start" : "justify-center"
          }`}
        >
          <LogOut className={`h-4 w-4 ${isExpanded || isMobileOpen ? "mr-2" : ""}`} />
          {(isExpanded || isMobileOpen) && "Sign out"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Hover-Expand Sidebar */}
      <aside
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={`sidebar-scroll hidden h-full shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-100/95 px-3 py-4 shadow-xl transition-all duration-300 dark:border-gray-700 dark:bg-gray-800/95 dark:shadow-black/30 md:flex md:flex-col ${
          isExpanded ? "w-72" : "w-24"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="sidebar-scroll relative z-10 flex h-full w-72 flex-col overflow-y-auto border-r border-gray-200 bg-gray-100 px-3 py-4 shadow-2xl transition-all dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={onMobileClose}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;
