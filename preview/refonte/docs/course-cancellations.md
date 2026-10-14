# Évaluation discrète et annulation ponctuelle de cours

« Évaluation » devient un lien texte discret sans fond, bordure ni encadré. Sa cible, son état désactivé sans grille et son indicateur de focus sont conservés.

Depuis le calendrier : ouvrir une journée → Annuler des cours → sélectionner les périodes concernées → motif Sortie scolaire → Annuler et reporter ces cours. Le détail d’un cours possède aussi l’action Annuler ce cours. L’annulation porte sur groupe + date + clé d’occurrence, pas sur tous les groupes ni sur les autres périodes du même groupe.

L’occurrence annulée reste dans l’horaire source et apparaît comme annulée dans les vues semaine/mois/journée. Elle est exclue des périodes utilisables par la projection. Les séances annuelles se reportent dans le même ordre; leurs identifiants, contenus, quantités et associations de grilles sont conservés. Les dates suivantes, y compris celle de l’examen, peuvent donc être décalées. Un manque de périodes en fin d’année est signalé, sans suppression de séance ni changement du nombre de cours.

Une séance individuelle existante est déplacée vers la prochaine occurrence non annulée du groupe n’ayant pas déjà une séance individuelle. Le placement précédent est enregistré dans l’exception. S’il n’y a pas de période disponible, son contenu est conservé et une alerte demande de la replacer. Une annulation peut être retirée via Rétablir ce cours ou les paramètres; le déplacement individuel est rétabli seulement s’il n’a pas depuis été changé par l’utilisateur.

Avant une annulation, une sauvegarde des exceptions et placements individuels est créée dans `previewHenriSlate:backupBeforeCourseCancellation:<id>`. La persistance partagée protège les écritures; une erreur avant validation restaure la mémoire. Le cours n’est pas marqué annulé si l’enregistrement échoue.

Validation : scénario Chromium `browser-cancellations.cjs` réussi au format iPad. Deux groupes annulés le vendredi 16 octobre 2026, troisième groupe inchangé, mêmes séquences/contenus/quantités avant et après, séance et examen reportés, ouverture de l’examen à sa nouvelle date, rechargement stable, rétablissement d’un groupe, distinction de deux périodes du même groupe, alerte de dépassement, déplacement/rétablissement d’une séance individuelle, erreur de persistance simulée sans annulation partielle. Les styles calculés confirment fond transparent, bordure nulle et lien compact. Les 14 tests de planification et scénarios de sauvegarde KEEP/évaluations restent réussis.

Le nom des deux groupes réels de l’enseignant n’a pas été fourni à la livraison : aucune sortie réelle n’est préenregistrée au hasard. Le formulaire permet de sélectionner exactement les cours concernés sur l’iPad. Les données restent locales au navigateur.
