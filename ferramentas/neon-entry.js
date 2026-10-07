// Ponto de partida do arquivo que liga o Dashvia ao Neon.
// O comando "npm run build" transforma este arquivo em neon.bundle.js,
// que as páginas carregam com uma tag <script> (no lugar do Supabase).
import { createClient } from "@neondatabase/neon-js";

// Endereços públicos do projeto no Neon (não são segredo; quem protege os dados são as regras do banco)
const URL_DO_LOGIN = "https://ep-sparkling-block-b6o7q0i1.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth";
const URL_DOS_DADOS = "https://ep-sparkling-block-b6o7q0i1.apirest.c-2.sa-east-1.aws.neon.tech/neondb/rest/v1";

window.dashviaNeon = createClient({
  auth: { url: URL_DO_LOGIN },
  dataApi: { url: URL_DOS_DADOS }
});
