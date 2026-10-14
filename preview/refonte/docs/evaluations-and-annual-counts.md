# Dernier cours, évaluations planifiées et quantités annuelles exactes

## Dernier cours = évaluation

Un bouton « Évaluation » accompagne le dernier cours réel de chaque séquence dans les vues semaine, mois et journée. Le numéro de cours reste visible. Le repère est borné par la capacité annuelle : une ancienne séquence surdimensionnée ne crée jamais une période supplémentaire. Dans le cas KEEP d’une séquence de quatre séances dans un bloc de cinq périodes, la séance quatre est l’évaluation; la cinquième période reste à planifier.

Sans grille enregistrée, le bouton affiche « Évaluation · À planifier » et reste désactivé. L’enseignant prépare sa grille dans Planifier → Évaluation, choisit groupe(s), sport et séquence, puis enregistre. Le dernier cours est proposé par défaut. Une grille peut toujours être attribuée à un autre cours, mais elle ne crée alors pas un lien d’évaluation finale.

Les nouvelles grilles portent une association `sequenceTargets` par groupe, fondée sur l’identifiant du bloc annuel ou de la séquence autonome. Deux séquences du même sport ne partagent donc pas automatiquement une évaluation. Pour plusieurs groupes, le choix utilise le même rang de séquence du sport dans chaque annuel; un groupe sans cible correspondante empêche l’enregistrement. Le sélecteur précise le rang et le nombre de cours.

Le bouton actif ouvre la grille enregistrée pour le groupe et la date concernés, avec la saisie des notes. Si plusieurs grilles correspondent, une sélection explicite apparaît. Les grilles anciennes sans association sont reconnues uniquement lorsqu’une seule séquence du sport existe pour ce groupe; en cas d’ambiguïté, l’enseignant doit modifier et réenregistrer la grille avec une séquence explicite. Une suppression de grille désactive son lien sans effacer les résultats précédemment sauvegardés.

## Les nombres de cours annuels restent inchangés

La copie multi-groupes de l’annuel redistribuait proportionnellement les périodes pour remplir le groupe destinataire. Ce chemin pouvait transformer un bloc de quatre cours en cinq. Il copie maintenant les nombres exacts du plan source, avec des identifiants de blocs indépendants. Les périodes supplémentaires restent disponibles. Un groupe disposant de moins de périodes reçoit les mêmes nombres de cours avec un dépassement signalé; aucun bloc n’est étiré, supprimé ou raccourci automatiquement.

Avant le remplacement d’un annuel existant d’un groupe destinataire : confirmation et archivage du plan et des séquences. Un échec d’archivage ou de persistance empêche le remplacement.

Une séance individuelle placée dans une période annuelle remplace cette période sans décaler les autres blocs. Une séance individuelle placée dans une période libre porte `independent: true` : elle réserve cette période et réduit le solde disponible, sans agrandir les blocs annuels. Un bloc ajouté ensuite occupe une autre période libre.

Les anciennes copies déjà agrandies ne sont pas devinées ni réduites automatiquement : il faut réappliquer l’annuel source avec les bons nombres aux groupes concernés. Les données de chaque navigateur restent locales; la mise à jour du code ne donne pas accès aux données de l’iPad.

## Validation

- 14 tests unitaires réussis, incluant copies multi-groupes 4 + 4 avec périodes restantes, réservation d’une séance indépendante et ancienne séquence de cinq séances bornée par un bloc annuel de quatre.
- `browser-evaluation-links.cjs` : finales 4/4 et 5/5, boutons désactivés sans grille, planification et modification réelle via l’éditeur, association exacte groupe/séquence malgré deux séquences Badminton, notes enregistrées puis retrouvées après rechargement, KEEP 4/5, suppression préservant les notes, refus d’associer une ancienne grille ambiguë.
- `browser-annual-capacity.cjs` : deux groupes de 8 et 10 périodes; Ultimate 4 + conditionnement physique 4 inchangés, deux périodes libres après copie et rechargement, réservation individuelle d’une période, ajout explicite d’un bloc d’une période.
- Les scénarios Chromium existants `browser-sequence-keep.cjs` et `browser-course-numbers.cjs` restent réussis.
- Syntaxe JavaScript et diff vérifiés. Les tests navigateur utilisent un viewport iPad; Safari sur appareil réel reste une validation manuelle.
