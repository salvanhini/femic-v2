import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/hooks/use-auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Layout from "@/components/layout/Layout";
import LoginPage from "@/pages/LoginPage";
import AgendaPage from "@/pages/AgendaPage";
import DashboardPage from "@/pages/DashboardPage";
import PacientesPage from "@/pages/PacientesPage";
import PacotesPage from "@/pages/PacotesPage";
import RelatorioPage from "@/pages/RelatorioPage";
import BackupPage from "@/pages/BackupPage";
import ProntuarioPage from "@/pages/ProntuarioPage";
import ConfiguracoesPage from "@/pages/ConfiguracoesPage";
import CaptacaoPage from "@/pages/CaptacaoPage";
import ExternalFormPage from "@/pages/ExternalFormPage";
import LembretesPage from "@/pages/LembretesPage";
import DocumentosPacientePage from "@/pages/DocumentosPacientePage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter basename="/femic-v2">
          <AuthProvider>
            <ErrorBoundary>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/formulario-externo" element={<ExternalFormPage />} />
                <Route element={<Layout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/agenda" element={<AgendaPage />} />
                  <Route path="/pacientes" element={<PacientesPage />} />
                  <Route path="/servicos" element={<Navigate to="/configuracoes?aba=servicos" replace />} />
                  <Route path="/pacotes" element={<PacotesPage />} />
                  <Route path="/relatorio" element={<RelatorioPage />} />
                  <Route path="/backup" element={<BackupPage />} />
                  <Route path="/prontuario" element={<ProntuarioPage />} />
                  <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                  <Route path="/captacao" element={<CaptacaoPage />} />
                  <Route path="/lembretes" element={<LembretesPage />} />
                  <Route path="/documentos" element={<DocumentosPacientePage />} />
                </Route>
              </Routes>
            </ErrorBoundary>
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
