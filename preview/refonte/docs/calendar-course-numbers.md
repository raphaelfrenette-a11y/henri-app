# Numéros de cours et ouverture directe depuis le calendrier

Chaque occurrence annuelle porte désormais un `courseIndex` et un `courseTotal` distincts de l’index d’une séance existante. Le calendrier semaine/mois affiche « Cours n/total », même si ce cours reste à planifier. Les cinq périodes d’un bloc affichent ainsi 1/5 à 5/5 lorsqu’il ne contient que quatre séances.

Les cartes semaine, les boutons de cours mensuels et les liens des cours de la journée utilisent `openCalendarCourse` : ouverture directe de la séance exacte via son identifiant stable, ou détail du cours avec les actions « Créer la séquence » / « Créer une séance seule ». Si une séquence existe mais n’a pas de séance à ce rang, l’action propose de créer/compléter la séquence existante. Les parcours PDF et le détail de cours restent disponibles via leurs fonctions existantes.

La préparation d’une séance seule préremplit le sport, le groupe, la compétence et l’occurrence ciblée. Elle remplace cette période, sans retirer une occurrence de la projection annuelle ni déplacer les blocs suivants. Le total affiché reste celui des périodes annuelles, et non celui des séances déjà créées. Le libellé spécial « Évaluation » pour Ultimate 4 est retiré pour rendre son numéro visible aussi.

Vérifications réalisées :

- 11 tests unitaires réussis, dont ordinal présent sans séance et séance individuelle sans décalage.
- `tests/browser-course-numbers.cjs` réussi dans Chromium, viewport iPad 834 × 1194 : numéro 3/5 et 5/5 en semaine, numéros dans le mois, clic réel ouvrant séance 3, cours manquant proposant les deux chemins, préremplissage Badminton au cours 5, placement individuel sans décalage de Volleyball, rechargement et ouverture de cette séance individuelle, création de séquence depuis un bloc sans contenu.
- Le scénario existant `tests/browser-sequence-keep.cjs` reste réussi : sauvegarde multi-groupes, édition, rechargement, KEEP, banque, stockage PDF, équipes et création de grille d’évaluation.
- Syntaxe JavaScript embarquée et modules vérifiés, `git diff --check` réussi.

Commandes depuis la racine, avec le serveur de test disponible sur le port 8765 :

```sh
node tests/sequence-keep.test.cjs
node tests/browser-course-numbers.cjs
node tests/browser-sequence-keep.cjs
```

La validation Safari sur iPad réel reste manuelle. Cette livraison concerne la prévisualisation `preview/refonte/`; l’entrée de l’application historique à la racine est préservée.
