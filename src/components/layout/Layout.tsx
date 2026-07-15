import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Wrench,
  Package,
  FileBarChart,
  FileText,
  Database,
  Stethoscope,
  Settings,
  MessageCircle,
  FileInput,
  Paperclip,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: Users, label: "Pacientes", path: "/pacientes" },
  { icon: Wrench, label: "Serviços", path: "/servicos" },
  { icon: Package, label: "Pacotes", path: "/pacotes" },
  { icon: FileBarChart, label: "Relatório", path: "/relatorio" },
  { icon: FileText, label: "Captação", path: "/captacao" },
  { icon: Stethoscope, label: "Prontuário", path: "/prontuario" },
  { icon: MessageCircle, label: "Lembretes", path: "/lembretes" },
  { icon: FileInput, label: "Guias", path: "/guias" },
  { icon: Paperclip, label: "Documentos", path: "/documentos" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
  { icon: Database, label: "Backup", path: "/backup" },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/agenda": "Agenda",
  "/pacientes": "Pacientes",
  "/servicos": "Serviços",
  "/pacotes": "Pacotes",
  "/relatorio": "Relatório",
  "/prontuario": "Prontuário",
  "/captacao": "Captação",
  "/lembretes": "Lembretes WhatsApp",
  "/guias": "Guias de Convênio",
  "/documentos": "Documentos do Paciente",
  "/backup": "Backup",
  "/configuracoes": "Configurações",
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] || "FEMIC";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        items={navItems}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="min-w-0 flex flex-1 flex-col">
        <Topbar
          title={title}
          onMenuClick={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
