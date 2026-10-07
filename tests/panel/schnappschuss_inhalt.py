#!/usr/bin/env python3
"""Inhaltlicher Vergleich zweier Schnappschüsse (tests/panel/schnappschuss.js) für Lit-Umstellungen (BSM-022 Stufe 3):
blendet aus, was beim Umstellen gewollt wegfällt oder dazukommt – Lit-Markierungen und -Behälter, data-*-Attribute
(alte data-act und neue Test-Merkmale), Klassen-Merkmale für Tests, value-Attribut der Suche, Reihenfolge der Attribute – und meldet je Schritt
„gleich“, „gleich bis auf </div> des Lit-Behälters“, abweichende Befehle oder die erste Abweichung.
   python3 tests/panel/schnappschuss_inhalt.py vorher.json nachher.json
"""
import json,re,sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
def norm(h):
    h=re.sub(r'<!--.*?-->','',h); h=h.replace('<div class="lit-bereich">','')
    h=re.sub(r' (data-[a-z0-9-]+|role)="[^"]*"','',h); h=re.sub(r'(<input class="vl-suche"[^>]*?) value="[^"]*"', r'\1', h)
    h=re.sub(r' (ml-status|ml-weg|dev-md|dev-json|dev-diagnose|bs-csv|bs-aktiv|ml-stand|ml-senden|ml-zurueck|nur-admin|vor-ort)(?=[ "])','',h)
    h=re.sub(r'<([a-zA-Z][\w-]*)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*(/?)>', lambda m: '<'+m.group(1)+''.join(' '+x for x in sorted(re.findall(r'[^\s=>]+(?:="[^"]*")?', m.group(2))))+m.group(3)+'>', h)   # Lit setzt gebundene Attribute ans Ende (3c/3d): Reihenfolge egal
    h=re.sub(r'class="([^"]*)"',lambda m:'class="'+' '.join(sorted(m.group(1).split()))+'"',h)   # Reihenfolge der Klassen egal (3d)
    h=re.sub(r' class=""','',h)
    h=re.sub(r'\s+',' ',h); h=re.sub(r'> <','><',h); h=h.replace(' >','>'); return h
for k in a:
    if a[k]==b[k]: continue
    x,y=norm(a[k]['html']),norm(b[k]['html'])
    if a[k]['befehle']!=b[k]['befehle']: print(k,'BEFEHLE verschieden'); continue
    if x==y: print(k,'gleich'); continue
    xs, ys = x.replace('</div>',''), y.replace('</div>','')
    if xs==ys: print(k,'gleich bis auf </div> des Lit-Behälters'); continue
    i=0
    while i<min(len(x),len(y)) and x[i]==y[i]: i+=1
    print(k, f'bei {i}: …{x[i-110:i+90]}…\n   ≠ …{y[i-110:i+90]}…')
