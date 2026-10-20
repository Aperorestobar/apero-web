#!/bin/bash
# Publica en public_html la última versión del repositorio GitHub Aperorestobar/apero-web.
# Lo ejecuta cPanel cada 5 minutos (Cron Jobs). Descarga directa del paquete (sin la API de GitHub, que tiene límite de consultas).
set -e
REPO="Aperorestobar/apero-web"
WEB="$HOME/public_html"
STATE="$HOME/.apero-web-version"
TMP="$HOME/.apero-web-tmp"
LOG="$HOME/.apero-web-deploy.log"

# Primera publicación: el WordPress antiguo (sin uso) se MUEVE completo a ~/respaldo-wordpress-FECHA.
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

rm -rf "$TMP"; mkdir -p "$TMP"
if ! curl -fsSL --retry 2 -m 60 "https://codeload.github.com/$REPO/tar.gz/refs/heads/main" -o "$TMP/web.tgz"; then
  echo "$(date '+%F %T') descarga fallida" >> "$LOG"; rm -rf "$TMP"; exit 0
fi
SUM=$(md5sum < "$TMP/web.tgz" | cut -d' ' -f1)
if [ -f "$STATE" ] && [ "$(cat "$STATE")" = "$SUM" ] && [ -f "$WEB/index.html" ]; then rm -rf "$TMP"; exit 0; fi

mkdir -p "$TMP/x"
tar -xzf "$TMP/web.tgz" -C "$TMP/x" --strip-components=1
cd "$TMP/x"
[ -f index.html ] || { echo "$(date '+%F %T') paquete sin index.html" >> "$LOG"; exit 1; }
mkdir -p "$WEB/img"
cp -f index.html reserva.html favicon.png apple-touch-icon.png build.txt "$WEB"/
cp -f img/* "$WEB/img/"
# .htaccess: se reemplaza solo si es el nuestro (o no existe)
if [ ! -f "$WEB/.htaccess" ] || grep -q "Options -Indexes" "$WEB/.htaccess"; then cp -f .htaccess "$WEB/"; fi
# El menú del día viene solo desde el script de Google; se eliminan archivos antiguos que exponían la semana.
rm -f "$WEB/lunch.json"
rm -rf "$WEB/admin"
echo "$SUM" > "$STATE"
touch "$WEB/.apero-web-ok"
echo "$(date '+%F %T') publicado $(cat build.txt 2>/dev/null)" >> "$LOG"
cd "$HOME" && rm -rf "$TMP"
