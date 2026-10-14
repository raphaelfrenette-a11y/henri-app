# Sortie du 16 octobre et bouton Évaluation centré

L’enseignant a précisé les groupes EDU4G2-01 et EDU4G2-02 pour la sortie du vendredi 16 octobre 2026.

Au chargement, après reconstruction du calendrier, le système reconnaît uniquement ces codes explicites, en ignorant la casse et les séparateurs. Il utilise les codes des occurrences ou les métadonnées du groupe; il ne déduit pas le volet G2 d’un simple nom « Secondaire 4 Groupe 01 ». Les cours correspondants à cette date sont annulés via le mécanisme existant de sauvegarde et de report, sans modifier les autres groupes ou les autres dates.

Le marqueur local `previewHenriSlate:outing2026-10-16:v1` évite les doublons par code. Il respecte un rétablissement ultérieur volontaire du cours par l’enseignant. Un code absent n’est pas marqué comme traité; il pourra être appliqué lorsque l’horaire sera généré/importé. La même vérification est exécutée après génération de l’horaire.

La modification des données locales nécessite le chargement de la mise à jour sur l’iPad. Aucun accès direct aux listes ou au calendrier de cet appareil n’est effectué depuis cet environnement.

« Évaluation » redevient un vrai bouton compact : bordure fine neutre, fond clair, angles de 7 px, texte et bouton centrés, hauteur minimale 30 px, sans le grand encadré bleu initial. Le bouton désactivé conserve le libellé bref; son titre et son libellé accessible indiquent que la grille doit être planifiée. Les liens et la navigation vers les grilles sont conservés.

Validation : `browser-friday-outing.cjs` réussi au format iPad 834 × 1194 : application automatique des deux codes, protection d’EDU4G1-01, date du 16 octobre seulement, report des séances/examen, quantités inchangées, absence de doublon après rechargement, rétablissement respecté au chargement suivant, centrage mesuré à moins d’un pixel, largeur compacte et ouverture effective de l’évaluation. Capture inspectée. Le scénario complet d’annulations manuelles et les 14 tests de planification restent réussis.
