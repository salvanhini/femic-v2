import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Wrench,
  Shield,
  Package,
  FileBarChart,
  Database,
  Bot,
  Stethoscope,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: Users, label: "Pacientes", path: "/pacientes" },
  { icon: Wrench, label: "Serviços", path: "/servicos" },
  { icon: Shield, label: "Convênios", path: "/convenios" },
  { icon: Package, label: "Pacotes", path: "/pacotes" },
  { icon: FileBarChart, label: "Relatório", path: "/relatorio" },
  { icon: Stethoscope, label: "Prontuário", path: "/prontuario" },
  { icon: Bot, label: "Assistente", path: "/assistente" },
  { icon: Database, label: "Backup", path: "/backup" },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/agenda": "Agenda",
  "/pacientes": "Pacientes",
  "/servicos": "Serviços",
  "/convenios": "Convênios",
  "/pacotes": "Pacotes",
  "/relatorio": "Relatório",
  "/prontuario": "Prontuário",
  "/assistente": "Assistente IA",
  "/backup": "Backup",
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] || "FEMIC";

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={navItems}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col">
        <Topbar
          title={title}
          onMenuClick={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
