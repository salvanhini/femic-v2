import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut, Menu, Sparkles } from "lucide-react";

interface TopbarProps {
  onMenuClick: () => void;
  title?: string;
}

export function Topbar({ onMenuClick, title = "FEMIC" }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b border-slate-200/80 bg-background/80 px-4 backdrop-blur-xl dark:border-slate-800 sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div>
        <div className="mb-0.5 hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:flex">
          <Sparkles className="h-3 w-3 text-femic-cyan" /> FEMIC
        </div>
        <h1 className="text-lg font-bold tracking-tight">{title}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={toggleTheme} aria-label="Alternar tema">
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>

        <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-destructive" onClick={signOut} aria-label="Sair da conta">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
