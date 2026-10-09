// Gera o par de chaves VAPID das notificações push.
// A chave PÚBLICA vai no código do site (js/notificacoes-push.js).
// A chave PRIVADA fica só como segredo da função no Supabase (VAPID_PRIVATE_KEY) — nunca no repositório.
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });

const publica = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]).toString("base64url");

console.log("VAPID_PUBLIC_KEY=" + publica);
console.log("VAPID_PRIVATE_KEY=" + priv.d);
