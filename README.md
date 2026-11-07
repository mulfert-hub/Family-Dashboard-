# Familie Ulfert

Die gemeinsame App der Familie, aufgebaut wie ein kleiner App Store, mit **einem** Icon auf dem Home-Bildschirm:

- **Start:** unsere Apps als Symbole, ein Tipp öffnet sie.
- **Entdecken:** alle Apps mit Highlight, Listen und Detailseiten (Beschreibung, Funktionen, Bildschirmfotos).
  „Laden“ legt eine App auf den Startbildschirm, auf der Detailseite lässt sie sich wieder entfernen.
  Das merkt sich jedes Handy für sich.

Derzeit:

| App | Status |
| --- | --- |
| 🍳 [Kochbuch](https://github.com/mulfert-hub/Kochbuch) | live, unter `…/Family-Dashboard-/kochbuch/` |
| 🏠 Haushalt | in Arbeit |
| ✅ Aufgaben & Taschengeld (für unsere Tochter) | in Arbeit |

Adresse nach dem Veröffentlichen: **https://mulfert-hub.github.io/Family-Dashboard-/**

## So funktioniert es

- Jede App bleibt in **ihrem eigenen Repository** und wird dort weiterentwickelt.
- Beim Veröffentlichen baut der Workflow dieses Repositorys zuerst die Startseite und dann jede App aus
  [`apps.json`](apps.json) und legt sie als Unterordner daneben (z. B. `kochbuch/`). Alles zusammen geht auf GitHub Pages.
- Der installierte Bereich der Startseite umfasst die Unterordner. Deshalb öffnen sich die Apps aus der
  installierten „Familie Ulfert“-App heraus im Vollbild und nicht in einem Browserfenster.
- Jede App hat weiterhin ihren eigenen Service Worker (offline). Der Service Worker der Startseite lässt die
  Unterordner der Apps bewusst in Ruhe.
- **Daten:** Jede App auf dem Home-Bildschirm hat ihren eigenen Speicher. Auf dem iPhone gilt das auch, wenn zwei
  Apps dieselbe Adresse haben. Das Kochbuch in „Familie Ulfert“ beginnt deshalb mit leerem Speicher:
  1. **Mehr → Rezepterkennung mit Claude:** den API-Schlüssel noch einmal eintragen.
  2. **Mehr → Synchronisation:** Daten-Repository und Token eintragen, damit die Rezepte herunterladen.
     Ohne Synchronisation geht es über ein Backup: im alten Kochbuch exportieren, im neuen importieren.
  3. Danach kann das einzelne Kochbuch-Icon vom Home-Bildschirm weg.

## Einrichtung (einmalig)

1. Repository → **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
2. Änderungen in den Branch `main` bringen. Der Workflow `.github/workflows/deploy.yml` veröffentlicht automatisch.
3. Die Adresse auf dem Handy öffnen und installieren:
   - **iPhone (Safari):** Teilen-Symbol → **„Zum Home-Bildschirm“**
   - **Android (Chrome):** Menü ⋮ → **„App installieren“**

Neue Versionen der eingebundenen Apps kommen spätestens mit dem täglichen Neubau (03:17 UTC) an. Sofort geht es
über **Actions → Deploy auf GitHub Pages → Run workflow**.

## Eine neue App hinzufügen

In [`apps.json`](apps.json) einen Eintrag ergänzen oder einen Platzhalter auf `"live"` stellen:

```json
{
  "id": "haushalt",
  "name": "Haushalt",
  "untertitel": "Alles rund ums Zuhause",
  "beschreibung": "Längerer Text für die Detailseite.",
  "funktionen": ["Putzplan", "Vorräte"],
  "kategorie": "Zuhause",
  "icon": "haushalt",
  "farbe": "#3f8fb0",
  "status": "live",
  "highlight": false,
  "screenshots": ["screenshots/haushalt-1.jpg"],
  "path": "haushalt/",
  "repo": "mulfert-hub/Haushalt",
  "branch": "main"
}
```

Bildschirmfotos kommen nach `public/screenshots/` (Hochformat, etwa 540 × 1168 Pixel, JPG).
`"highlight": true` zeigt die App groß oben in „Entdecken“.

Voraussetzungen an die App (das Kochbuch erfüllt sie bereits):

- `npm ci` und `npm run build` bauen sie nach `dist/`.
- Sie liest den Pfad aus der Umgebungsvariable `BASE_PATH` (bei Vite: `base: process.env.BASE_PATH ?? '/'`)
  und nutzt relative Adressen bzw. Hash-Routing.
- Optional: `VITE_FAMILIE_URL` enthält die Adresse der Startseite, z. B. für einen Knopf „← Familie Ulfert“.

Symbole für die Kacheln stehen in [`src/icons.ts`](src/icons.ts).

## Entwicklung

Voraussetzung: Node.js ab Version 20.

```bash
npm install
npm run dev        # Startseite lokal
npm test           # prüft apps.json
npm run build:all  # Startseite + alle Apps nach dist/
# eine lokale Kopie statt Klonen verwenden:
APPS_LOCAL=kochbuch=../Kochbuch npm run build:all
```

Die Icons werden aus `public/icons/icon.svg` erzeugt: `npm run icons` (braucht Playwright).
