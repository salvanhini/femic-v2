import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos do build
app.use("/femic-v2", express.static(join(__dirname, "dist")));

// SPA fallback - todas as rotas servem index.html
app.get("/femic-v2/*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Redirecionar raiz para /femic-v2/
app.get("/", (req, res) => {
  res.redirect("/femic-v2/");
});

app.listen(PORT, () => {
  console.log(`FEMIC v2 rodando na porta ${PORT}`);
});
