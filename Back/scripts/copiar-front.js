// Copia el build del Front (Front/dist) a Back/public, reemplazando lo anterior.
const fs = require("fs");
const path = require("path");

const origen = path.join(__dirname, "..", "..", "Front", "dist");
const destino = path.join(__dirname, "..", "public");

if (!fs.existsSync(path.join(origen, "index.html"))) {
  console.error("No existe Front/dist. Corré primero `npm run build` en Front/.");
  process.exit(1);
}

fs.rmSync(destino, { recursive: true, force: true });
fs.cpSync(origen, destino, { recursive: true });
console.log(`Front copiado a ${destino}`);
