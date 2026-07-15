import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

interface SidebarItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

interface SidebarProps {
  items: SidebarItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ items, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-slate-200/80 bg-card/95 shadow-2xl shadow-slate-900/10 backdrop-blur transition-transform dark:border-slate-800 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0 lg:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-20 items-center gap-3 border-b px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-femic-navy via-femic-navy to-femic-cyan text-sm font-black text-white shadow-lg shadow-femic-navy/20">
            F
          </div>
          <div>
            <strong className="block text-sm tracking-[0.18em] text-femic-navy dark:text-sky-300">FEMIC</strong>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Gestão clínica</p>
          </div>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-primary to-femic-navy text-primary-foreground shadow-md shadow-primary/15"
                    : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
