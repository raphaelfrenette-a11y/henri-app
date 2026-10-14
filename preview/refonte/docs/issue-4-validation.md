# Issue #4 — sauvegarde des séquences et règle KEEP

Travail limité à la refonte v560. Le scénario principal est corrigé; ce rapport ne clôt pas le mandat complet de finalisation. Aucun fichier de l’application historique ni Preview V2 n’est modifié.

## Inventaire des flux

| Module | Entrées et responsabilités | Stockage |
| --- | --- | --- |
| Accueil/calendrier | `getGroupCourseOccurrences`, `rebuildCalendarPlanning`, détail `openCourseEntry`, éditeur `openCalendarSession` | Horaire importé et occurrences; contenu reprojeté à chaque chargement |
| Paramètres/import | Import groupes, grille horaire revue, calendrier, photos/PDF/OCR, exceptions, génération `generateMySchedule` | `henriImportedGroups`, `henriGroupsData`, `henriImportedTeacherSchedule`, `henriImportedSchoolCalendar`, `henriScheduleEntries`, `henriSchoolDays`, `henriCalendarExceptions` |
| Annuel | Création/répartition Henri, copies multi-groupes, tri, capacités, `saveAnnual`, `updateAnnualBlock` | `henriAnnualPlans`, `henriScheduleConflictIgnores` |
| Séquences | `makeSequence`, `createSequenceFromMacro`, `buildStandaloneSequence`, `saveSequence`, `henriSaveSequenceForGroups`, `henriSyncSequenceToAnnual` | `henriSequences`, `henriActiveSequence`; clé groupe/bloc `groupId::blockId`, séquences datées `dated::id` |
| Séances | Objectifs PDA/PFEQ ou personnalisés, sections, réorganisation, suppression; individuelles | Sessions imbriquées dans les séquences, `henriIndividualSessions` |
| Banque | Archivage avant remplacement, copies indépendantes, export/import JSON, PDF original et adaptation locale | IndexedDB `preview-henri-slate-planning-bank-v1`, magasin `items`; `henriAnnualBankId:<groupe>` |
| PDF calendrier | Document entier associé à plusieurs occurrences, ouverture depuis le détail | `calendarPdfPlans:v1` + blob IndexedDB |
| Outils | Répartition équipes, habiletés, genres, leaders, compatibilités/incompatibilités, absences, historique, équipes par cours | `henriTeamHistory`, équipes par cours; élèves dans `henriGroupsData` |
| Évaluations | Grilles manuelles/Henri C1/C2/C3, sport/groupes/cours, critères, maxima, pondérations totalisant 100 %, saisie élève, remarques, résultats dans profils et actions calendrier, suppression grille préservant résultats | `evaluations:v1`, `evaluationScores:v1` |

Toutes les clés localStorage ci-dessus utilisent le préfixe `previewHenriSlate:`. Les modules chargés après le script principal enveloppent certaines actions (PDF, évaluations, UX); les tests navigateur chargent l’ensemble réel.

## Corrections

- Entrée de prévisualisation ramenée à v560 : `main` pointait vers v561, non validée selon le mandat.

- Suppression de l’extension automatique d’Ultimate jusqu’au 28 octobre et du décalage spécial de ses quatre séances.
- Les cinq périodes du bloc accueillent les séances 1 à 4 puis « À planifier ». Les blocs suivants conservent leur offset annuel.
- Création = brouillon; l’enregistrement explicite ouvre les groupes puis valide toutes les affectations avant la persistance. Une erreur dans un groupe annule toutes les affectations nouvelles.
- L’édition d’une séquence déjà enregistrée actualise sa source sans modifier la capacité du bloc. Une nouvelle proposition ne remplace pas implicitement la séquence précédente.
- Copies multi-groupes et banque avec identifiants de séquence/séances indépendants. Confirmation et archive avant remplacement explicite.
- Limite du bloc vérifiée lors de création, ajout de séance, enregistrement et réutilisation banque.
- Projection calendrier reconstruite sans réécrire son contenu pédagogique dans `henriScheduleEntries`. L’horaire reste sauvegardé lors de sa génération.
- Sauts de cours explicites contenus dans leur bloc; ils ne raccourcissent plus les blocs suivants.
- Calendrier : résolution par identifiant de séance, avec compatibilité de l’index existant.

## Migration et reprise

Migration additive des identifiants de séances manquants, au démarrage. Les JSON précédents sont conservés dans `previewHenriSlate:backupBeforeSessionIds:v1` avant toute écriture. Les identifiants existants restent inchangés. La copie active d’une séquence enregistrée réutilise les mêmes identifiants. Une erreur de stockage restaure la mémoire; le mécanisme existant de persistance restaure les clés déjà écrites.

Le correctif Ultimate historique n’est plus appliqué. Un bloc déjà agrandi par ce correctif reste inchangé : son ancienne sauvegarde `backupBeforeUltimateOctoberFix:v1` est conservée. Aucune restauration de capacité n’est faite automatiquement, car elle pourrait déplacer des cours existants.

## Preuves obtenues le 14 octobre 2026

Les trois premiers tests ont aussi été exécutés contre les fichiers du commit de départ `4eaaec1` : trois échecs reproduits (capacité Ultimate augmentée de 5 à 8; édition réduisant le bloc de 5 à 4; 7 occurrences renvoyées pour un bloc de 5). Ils passent après correction.

| Test | Résultat |
| --- | --- |
| KEEP : 4 séances / 5 cours + Badminton après | Réussi, test unitaire et Chromium |
| Édition sans redimensionnement annuel | Réussi |
| Occurrences bornées au bloc, sauts bornés au bloc | Réussi |
| Multi-groupes : capacité invalide = aucune affectation partielle | Réussi |
| Copies indépendantes et identifiants distincts | Réussi, unitaire et Chromium |
| Erreur de persistance simulée : restauration mémoire | Réussi |
| Migration : sauvegarde initiale, IDs partagés active/enregistrée, idempotence | Réussi |
| Brouillon : protection de la séquence déjà enregistrée | Réussi |
| Horaire importé structuré, deux groupes et dates distinctes | Réussi, génération réelle dans Chromium; pas d’OCR de document réel |
| Génération Henri de 4 séances, ouverture et édition de chacune | Réussi, Chromium |
| Bouton Enregistrer → groupes → confirmation → rechargement | Réussi, Chromium |
| Séance 3 au bon cours, édition calendrier puis rechargement et lecture dans séquence | Réussi, Chromium |
| Banque : réutilisation sans mutation original, bloc de 5 préservé | Réussi, Chromium |
| PDF : conservation exacte du blob dans IndexedDB | Réussi; lecture/export graphique non vérifiés |
| Équipes : 6 élèves répartis en 2 équipes de 3, chacun une fois | Réussi; contraintes complexes/absences non exhaustivement vérifiées |
| Évaluations : création Henri, trois critères et persistance de la grille | Réussi; saisie de notes/résultats non exhaustivement vérifiée |
| Chargement et parcours principal sans erreur JavaScript | Réussi, Chromium |
| iPad Safari réel, navigation tactile, stockage privé/quota réel | À valider sur appareil; WebKit absent de cet environnement |
| Photos/PDF réels, OCR, export PDF, toutes exceptions/réinitialisation | À valider; les contrôles ci-dessus ne couvrent pas ces parcours complets |

## Reproduire

Depuis la racine du dépôt :

```sh
node tests/sequence-keep.test.cjs
npm --prefix tests install
python -m http.server 8765 --bind 127.0.0.1
# Dans un autre terminal :
node tests/browser-sequence-keep.cjs
```

Le navigateur utilise Chromium système si disponible, sinon celui installé par Playwright (`cd tests && npx playwright install chromium`). `HENRI_CHROMIUM` permet de fournir un exécutable; `HENRI_TEST_URL` permet un autre serveur. Le contexte navigateur de test est isolé et ne lit pas les données d’un utilisateur.

Avant publication : exécuter le même scénario sur iPad, puis les parcours restants indiqués ci-dessus. La refactorisation globale des fonctions embarquées dans le HTML et les autres tests de non-régression restent à poursuivre dans le mandat #4.
