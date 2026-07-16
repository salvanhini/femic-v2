import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import ProntuarioPage from "@/pages/ProntuarioPage";

const mocks = vi.hoisted(() => ({ organizeClinicalDraft: vi.fn() }));

vi.mock("@/lib/supabase/queries/patients", () => ({
  fetchPatients: vi.fn().mockResolvedValue([{ id: "patient-1", name: "Ana", archived: false }]),
}));

vi.mock("@/lib/supabase/queries/clinical", () => ({
  fetchAnamnesis: vi.fn().mockResolvedValue(null),
  upsertAnamnesis: vi.fn(),
  fetchEvolutions: vi.fn().mockResolvedValue([]),
  createEvolution: vi.fn(),
  deleteEvolution: vi.fn(),
}));

vi.mock("@/lib/supabase/queries/assistants", () => ({
  fetchDocuments: vi.fn().mockResolvedValue([]),
  createDocument: vi.fn(),
}));

vi.mock("@/lib/ai/clinical-ai", () => ({ organizeClinicalDraft: mocks.organizeClinicalDraft }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProntuarioPage />
    </QueryClientProvider>
  );
}

describe("ProntuarioPage", () => {
  it("mostra Avaliação complementar como campo único", async () => {
    renderPage();

    await screen.findByRole("option", { name: "Ana" });
    fireEvent.change(await screen.findByRole("combobox"), { target: { value: "patient-1" } });

    expect(await screen.findByLabelText("Avaliação complementar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mostrar avaliação complementar/i })).not.toBeInTheDocument();
  });

  it("identifica a sugestão da IA como Avaliação complementar", async () => {
    mocks.organizeClinicalDraft.mockResolvedValueOnce({ clinical_summary: "Dor ao movimento e limitação funcional." });
    renderPage();

    await screen.findByRole("option", { name: "Ana" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "patient-1" } });
    fireEvent.change(screen.getByPlaceholderText("Digite ou dite o resumo do atendimento, queixa e achados..."), { target: { value: "Paciente relata dor ao movimento e limitação funcional." } });
    fireEvent.click(screen.getByRole("button", { name: "Organizar com IA" }));

    expect(await screen.findByText(/Avaliação complementar:/i)).toBeInTheDocument();
  });
});
