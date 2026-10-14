# Retrait de l’enseignant des listes d’élèves

À la demande de Raphaël Frenette, les entrées correspondant exactement à « Raphaël Frenette » ou « Frenette, Raphaël » sont exclues des élèves, avec normalisation des accents, de la casse et de la ponctuation. Les champs prénom/nom séparés sont aussi reconnus. Les autres Raphaël et les autres Frenette restent inchangés.

Le nettoyage au chargement traite `henriGroupsData` et `henriImportedGroups`, puis les références correspondantes dans les compatibilités/incompatibilités, les équipes par cours, les absences des cours et l’historique des équipes. Les identifiants de groupes, les codes de cours, les autres élèves, les planifications et les notes d’évaluation sont conservés.

Les anciennes valeurs sont sauvegardées dans `previewHenriSlate:backupBeforeTeacherRosterRemoval:v1`. Un échec d’écriture restaure les anciennes clés; un échec de création de la sauvegarde empêche le nettoyage. Le nettoyage est idempotent.

Les lignes d’en-tête Enseignant/Professeur sont exclues du corps des listes. Le parseur PDF/texte et CSV filtre le nom exact, et la sauvegarde des groupes applique le même filtre : un nouvel import ne réintroduit pas l’enseignant.

La mise à jour doit être chargée sur l’iPad pour modifier ses données locales; aucun accès direct aux listes de cet appareil n’est effectué depuis cet environnement.

Validation : quatre tests unitaires dédiés réussis (variantes du nom, élèves conservés, sauvegarde/idempotence, erreur de stockage), scénario Chromium `browser-teacher-roster.cjs` réussi pour EDU3G2-05, équipes/absences, CSV et rechargement. Les 14 tests de planification restent réussis. La validation Safari réelle reste manuelle.
