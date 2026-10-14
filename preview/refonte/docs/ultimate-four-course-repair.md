# Réparer les anciens groupes Ultimate à quatre cours

À la demande explicite de l’enseignant : Ultimate comporte quatre cours et son examen doit correspondre au cours 4/4. La correction précédente préservait les quantités lors des nouvelles copies, mais laissait intactes les anciennes copies déjà étirées.

Une réparation unique, exécutée avant le chargement des plans et la projection du calendrier, normalise les blocs annuels Ultimate de quatre cours ou plus à quatre cours. Les blocs des autres sports et les blocs Ultimate plus courts ne sont pas modifiés. Les groupes déjà à quatre gardent leur nombre de cours. Les identifiants de groupes/blocs/séances existants sont conservés.

Les séquences enregistrées et le brouillon actif correspondant conservent leurs quatre premières séances. La cinquième séance et toutes les anciennes valeurs restent dans `previewHenriSlate:backupBeforeUltimateFourCoursesRepair:v1`, créée avant l’écriture. Les anciens liens d’évaluation Ultimate au-delà du quatrième cours sont ramenés à quatre pour les cibles annuelles concernées. Une association explicite à une séquence autonome reste inchangée; une grille sans association est reliée uniquement si le groupe possède un seul bloc annuel Ultimate. Les notes d’évaluation ne sont pas modifiées. Les sauts pointant vers une cinquième séance devenue hors bloc sont retirés.

Le calendrier est ensuite entièrement reprojeté : quatre occurrences Ultimate, affichage 1/4 à 4/4, Évaluation sur la quatrième, puis le bloc suivant. Les anciennes périodes supplémentaires ne sont pas maintenues artificiellement. L’utilisateur n’a pas à réappliquer manuellement les plans des groupes.

Le marqueur `previewHenriSlate:ultimateFourCoursesRepair:v1` rend la réparation idempotente. Il ne verrouille pas les choix futurs de l’enseignant. Si la sauvegarde ou une écriture échoue, la réparation s’arrête/restaure les anciennes clés et affiche une erreur; le marqueur n’est pas écrit.

Preuves : quatre tests unitaires dédiés réussis (groupes mixtes 4/5/8, examen, ancienne séquence 5 malgré annuel 4, erreur de stockage); scénario Chromium avec deux groupes, correction au rechargement, ouverture effective de l’examen au cours 4 et stabilité au rechargement suivant. Les 14 tests de planification, le scénario multi-groupes KEEP et le scénario des capacités annuelles restent réussis. Le test KEEP générique utilise désormais Badminton 4 séances / 5 périodes, afin de distinguer cet invariant de la réparation spécifique Ultimate demandée ici.

Les données restent dans le navigateur : la réparation s’applique au chargement de la version corrigée sur l’iPad.
