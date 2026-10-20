#!/bin/bash
# Publica en public_html la última versión del repositorio GitHub Aperorestobar/apero-web.
# Lo ejecuta cPanel cada 5 minutos (Cron Jobs). No necesita git: descarga con curl.
set -e
REPO="Aperorestobar/apero-web"
WEB="$HOME/public_html"
STATE="$HOME/.apero-web-version"
TMP="$HOME/.apero-web-tmp"

# Primera publicación: el WordPress antiguo (sin uso) se MUEVE completo a ~/respaldo-wordpress-FECHA,
# fuera de public_html. No se borra nada; para recuperarlo basta moverlo de vuelta.
if [ -f "$WEB/wp-config.php" ] && [ ! -f "$WEB/.apero-web-ok" ]; then
  BK="$HOME/respaldo-wordpress-$(date +%Y%m%d-%H%M)"
  mkdir -p "$BK"
  shopt -s dotglob nullglob
  for f in "$WEB"/*; do
    case "$(basename "$f")" in (.well-known|cgi-bin) ;; (*) mv "$f" "$BK"/ ;; esac
  done
  shopt -u dotglob nullglob
  rm -f "$STATE"
fi

SHA=$(curl -fsSL -H "Accept: application/vnd.github.sha" "https://api.github.com/repos/$REPO/commits/main" || true)
case "$SHA" in ([0-9a-f]*) ;; (*) exit 0 ;; esac
if [ -f "$STATE" ] && [ "$(cat "$STATE")" = "$SHA" ] && [ -f "$WEB/index.html" ]; then exit 0; fi

rm -rf "$TMP"; mkdir -p "$TMP"
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$SHA" | tar -xz -C "$TMP" --strip-components=1
cd "$TMP"
[ -f index.html ] || exit 1
mkdir -p "$WEB/img"
cp -f index.html reserva.html favicon.png apple-touch-icon.png build.txt "$WEB"/
# .htaccess: se reemplaza solo si es el nuestro (o no existe)
if [ ! -f "$WEB/.htaccess" ] || grep -q "Options -Indexes" "$WEB/.htaccess"; then cp -f .htaccess "$WEB/"; fi
cp -f img/* "$WEB/img/"
# El menú del día viene solo desde el script de Google (y solo el día de hoy).
# Se eliminan el archivo y el panel antiguos, que exponían la semana completa.
rm -f "$WEB/lunch.json"
rm -rf "$WEB/admin"
echo "$SHA" > "$STATE"
touch "$WEB/.apero-web-ok"
cd "$HOME" && rm -rf "$TMP"
