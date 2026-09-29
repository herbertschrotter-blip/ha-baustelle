# ha-baustelle

Home-Assistant-Projekt für die Baustelle: Shellys und andere Geräte anzeigen und schalten, Verbrauch und Messwerte
(z. B. Temperatur), Warnungen und Automationen, die auch vom Wetter am Ort der Baustelle gesteuert werden.

## Aufbau

```
ha/packages/baustelle.yaml     Paket: Automationen, Skripte, Template-Sensoren, Helfer → /config/packages/
ha/dashboards/baustelle.yaml   YAML-Dashboard „Baustelle“ → /config/dashboards/
tools/deploy.sh                Auslieferung nach /config
```

Quelle der Wahrheit ist dieses Repo (`/config/projekte/ha-baustelle`). `/config` ist nur das Ziel; dort nicht direkt
ändern.

## Voraussetzungen

- Die Shellys der Baustelle über die Shelly-Integration einbinden (Oberfläche, kein Teil dieses Repos).
- Wetter für die Baustelle als eigene Wetter-Integration (z. B. Met.no) mit deren Koordinaten, eingerichtet in der
  Oberfläche.
- In `configuration.yaml`: `homeassistant: packages: !include_dir_named packages` (vorhanden) und das Dashboard unter
  `lovelace: dashboards:`:

  ```yaml
  baustelle:
    mode: yaml
    title: Baustelle
    icon: mdi:crane
    show_in_sidebar: true
    filename: dashboards/baustelle.yaml
  ```

## Auslieferung

1. Änderungen im Repo machen und committen.
2. `tools/deploy.sh` kopiert Paket und Dashboard nach `/config`.
3. Konfiguration prüfen (Entwicklerwerkzeuge → YAML → Konfiguration prüfen).
4. Wirksam machen:
   - Automationen, Skripte, Template-Entitäten: passende Konfiguration neu laden.
   - Dashboard: Seite im Browser neu laden.
   - Neue Helfer-Domänen oder Änderungen an `configuration.yaml`: Neustart, nur durch Herbert.

## Nie ins Repo

Zugangsdaten (`!secret` verwenden, Werte trägt Herbert in `/config/secrets.yaml` ein), Koordinaten der Baustelle,
Gerätekennungen (MAC, Seriennummern), Tokens.
