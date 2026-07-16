import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConfiguracoesPage from "@/pages/ConfiguracoesPage";

vi.mock("@/lib/supabase/queries/services", () => ({
  fetchScheduleSettings: vi.fn().mockResolvedValue(null),
  fetchServices: vi.fn().mockResolvedValue([]),
  fetchHealthInsurances: vi.fn().mockResolvedValue([]),
}));

function renderSettings(path = "/configuracoes") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <ConfiguracoesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ConfiguracoesPage", () => {
  it("opens the services tab from the URL", () => {
    renderSettings("/configuracoes?aba=servicos");

    expect(screen.getByRole("button", { name: "Serviços" })).toHaveClass("border-b-2");
    expect(screen.getByRole("heading", { name: "Serviços" })).toBeInTheDocument();
  });

  it("defaults to the schedule tab for an unknown URL value", () => {
    renderSettings("/configuracoes?aba=invalida");

    expect(screen.getByRole("button", { name: "Horários" })).toHaveClass("border-b-2");
    expect(screen.getByRole("heading", { name: "Horários de Funcionamento" })).toBeInTheDocument();
  });

  it("opens the complete AI configuration tab from the URL", () => {
    renderSettings("/configuracoes?aba=ia");

    expect(screen.getByRole("heading", { name: "Assistente de IA" })).toBeInTheDocument();
    expect(screen.getByText("Provedor")).toBeInTheDocument();
    expect(screen.getByText("Modelo")).toBeInTheDocument();
    expect(screen.getByText("Chave de API")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração de IA" })).toBeInTheDocument();
  });
});
