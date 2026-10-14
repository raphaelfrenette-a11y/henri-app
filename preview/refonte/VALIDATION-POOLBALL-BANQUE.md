# Poolball et banque de planifications

Le calendrier et l’éditeur affichent « Poolball 1 » pour ce cours unique, sans dénominateur annuel hérité ni bouton d’évaluation. Les affectations restent intactes.

La banque compare le contenu pédagogique des séquences et des planifications annuelles, indépendamment des identifiants, des groupes et des dates. Une modification du contenu produit une variante distincte. Les PDF gardent leurs identifiants et leurs pièces jointes.

La migration IndexedDB conserve les originaux dans `dedupArchives`, les anciens identifiants dans `aliases` et les contenus uniques dans `items`, au sein d’une même transaction. Les groupes et les séances du calendrier ne sont pas supprimés. Les archives techniques ne gonflent pas le compteur visible de la banque.

Validation : 22 tests unitaires ; tests Chromium du regroupement, des archives, des anciens liens, des écritures simultanées, des variantes, des annuelles et de Poolball (dont séance individuelle) ; régressions des séquences KEEP, des numéros de cours, des évaluations, des capacités annuelles et des annulations.
