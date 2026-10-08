// Ponto de partida do arquivo que liga o Dashvia ao Supabase.
// O comando "npm run build" transforma este arquivo em supabase.bundle.js,
// que as páginas carregam com uma tag <script>.
import { createClient } from "@supabase/supabase-js";

// Dados públicos do projeto no Supabase (não são segredo; quem protege os dados são as regras do banco).
// Use a chave "anon" / "publishable". NUNCA coloque aqui a chave "service_role" / "secret".
const URL_DO_PROJETO = "https://ztlalhziwxijnlvhfhpp.supabase.co";
const CHAVE_PUBLICA = "sb_publishable_jQO74I6_ohkiJZfHZKCsiw_6FDrxHj9";

window.dashviaDb = createClient(URL_DO_PROJETO, CHAVE_PUBLICA);
