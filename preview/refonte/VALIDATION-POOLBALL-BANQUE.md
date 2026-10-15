# Poolball et banque de planifications

Le calendrier et l’éditeur affichent « Poolball 1 » pour ce cours unique, sans dénominateur annuel hérité ni bouton d’évaluation. Les affectations restent intactes.

La banque compare le contenu pédagogique des séquences et des planifications annuelles, indépendamment des identifiants, des groupes et des dates. Une modification du contenu produit une variante distincte. Les PDF gardent leurs identifiants et leurs pièces jointes.

La migration IndexedDB conserve les originaux dans `dedupArchives`, les anciens identifiants dans `aliases` et les contenus uniques dans `items`, au sein d’une même transaction. Les groupes et les séances du calendrier ne sont pas supprimés. Les archives techniques ne gonflent pas le compteur visible de la banque.

Validation : 22 tests unitaires ; tests Chromium du regroupement, des archives, des anciens liens, des écritures simultanées, des variantes, des annuelles et de Poolball (dont séance individuelle) ; régressions des séquences KEEP, des numéros de cours, des évaluations, des capacités annuelles et des annulations.

## Numérotation au changement de sport

Une séance individuelle d’un sport différent de celui du prochain bloc annuel occupe désormais une période séparée. Elle ne consomme plus silencieusement le cours 1 du prochain bloc. Une séance individuelle du même sport continue de compter une seule fois dans le bloc. Le calcul partagé sert aussi aux liens des séances et aux capacités annuelles, sans migration ni réécriture des plans enregistrés.

Régression ajoutée : deux groupes simulés EDU3G2-04 et EDU2G2-03, Poolball individuel avant le 5 novembre, puis badminton 1/4 à cette date (dont 12 h 35), ouverture de la séance 1, quatre cours de badminton, évaluation au quatrième, sport suivant au cours 1 et résultat identique après rechargement. Des tests unitaires couvrent également une ancienne affectation individuelle liée au mauvais bloc et la normalisation des noms de sports.
