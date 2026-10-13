# Henri

Application statique : `index.html` ouvre `henri-v560.html`. La refonte utilise une palette bleu ardoise, une typographie système, une navigation latérale sur ordinateur et quatre accès sur mobile. `henri-layout.css` conserve les règles de structure et de visibilité; `henri-design.css` définit les tokens sémantiques, les composants et leurs variantes responsive. `henri-ux.js` ajoute le prochain cours, les libellés accessibles et la gestion clavier de la fenêtre de choix de groupe. Il ne modifie pas les modèles ni le stockage.

Les groupes disposent de leur propre espace. Les paramètres regroupent les documents, les exceptions et la nouvelle année. Les sélecteurs sont natifs pour conserver les interactions clavier, tactile et lecteur d’écran. Aucun framework ni police distante supplémentaire n’est nécessaire.

Depuis le dépôt, démarrer avec `python3 -m http.server 8000` et ouvrir le serveur dans un navigateur. Aucun build ni compte serveur n’est nécessaire.

## Documents et calendrier

Dans **Configurer Henri**, importer les listes de groupes, l’horaire personnel et le calendrier scolaire, dans n’importe quel ordre. Chaque catégorie accepte plusieurs fichiers. Les PDF numérisés passent par la reconnaissance de texte, comme les photos. Les pages d’un même groupe sont regroupées et les identifiants existants sont conservés.

La vérification montre les correspondances entre jours-cycle, périodes, groupes et élèves. Les associations et les dates reconnues peuvent être corrigées avant de générer l’année. Les dates invalides, les périodes ambiguës, les jours-cycle absents et les dates de semaine manquantes bloquent la génération. Les jours sans cours doivent figurer dans l’horaire; les congés et journées pédagogiques doivent figurer dans le calendrier.

La reconnaissance utilise les libellés et positions réellement lus. Elle ne suppose ni un cycle de neuf jours, ni des heures de périodes fixes, ni une légende de couleurs universelle. La grille de douze mois en quatre colonnes est lue en distinguant les dates des petits chiffres de jour-cycle. Pour le calendrier secondaire 2026–2027 du CSS des Découvreurs fourni comme exemple, un modèle de référence identifié par son organisme, ses années, ses bornes et sa légende complète les cases illisibles; les données reconnues qui le contredisent sont refusées pour vérification. Ce modèle ne s’applique pas aux autres centres ou années. Les autres formats restent à adapter ou corriger si la lecture est incomplète. La lecture de photos synthétiques lisibles a été testée; les formats et la qualité des documents de l’école doivent être validés avec des exemples réels.

Après génération, ouvrir une date pour voir les groupes et les périodes, puis accéder aux élèves et aux séances/séquences associées. Une séquence indépendante peut être placée à partir d’une période précise. Les séances individuelles occupent seulement la période choisie, même si le groupe a plusieurs cours le même jour. Les autres séances se répartissent sur les périodes disponibles, en tenant compte des exceptions. Les heures de début et de fin sont lues dans les en-têtes de la grille. Les blocs d’intervention cognitive sont affichés séparément, sans consommer une séance d’éducation physique; le dîner n’est pas une période de cours.

Les cases « x », « y » et « z » des 21, 22 et 23 juin restent à préciser : elles sont affichées sans cours attribué. Une journée pédagogique flottante ajoutée aux exceptions bloque les cours de sa date sans décaler les jours-cycle imprimés suivants. Les séances pédagogiques déjà planifiées se répartissent sur les cours restants.

Les données restent dans le stockage de ce navigateur. Les bibliothèques PDF.js et Tesseract et leurs fichiers de travail sont chargés depuis les CDN déclarés dans l’application; leur accès doit fonctionner pour importer des photos/PDF. Aucun service d’IA distant n’est configuré.

## Vérification

- `node --test tests/import.test.js` : associations, dates, couverture annuelle et grilles d’horaire.
- `python3 tests/design_browser.py` : prochain cours, exclusions des cours bloqués et interventions cognitives, accès aux groupes, conservation du groupe sélectionné, formulaires natifs, clavier et focus de la fenêtre de groupe, génération d’équipes, persistance, réduction des animations et absence de débordement sur cinq formats (320 à 1440 pixels).
- `python3 tests/reference_calendar_browser.py` : calendrier de référence CSS, correspondances avec les onze groupes, cours et interventions distincts, jours de juin à préciser, journée flottante sans décalage du cycle.
- `python3 tests/calendar_browser.py` : import de documents texte, génération annuelle, congés, périodes multiples, liens de planification, modifications, exceptions et rechargement. Nécessite Python Playwright et `/usr/bin/chromium`; les CDN sont exclus de ce test.
- `python3 tests/photo_pdf_browser.py /tmp/henri-ocr-check` : photos lisibles générées, PDF texte multipage et PDF numérisé, avec le vrai moteur Tesseract. Nécessite également Pillow et reportlab. Ce test utilise un moteur OCR local pour le transport des tâches de reconnaissance, les mêmes traitements d’image et les mêmes parsers que l’application.

Pour préparer les bibliothèques locales du dernier test sans modifier les dépendances du dépôt :

```sh
npm install --prefix /tmp/henri-ocr-check --cache /tmp/henri-ocr-check/npm-cache --omit=optional --no-audit --no-fund tesseract.js@5.1.1 pdfjs-dist@3.11.174 @tesseract.js-data/fra@1.0.0 @tesseract.js-data/eng@1.0.0
```
