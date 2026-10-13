/* Fixed, decorative vector references; no data or storage changes. */
window.HenriVisuals = {
  sportSymbol(sport, kind) {
    if (kind === 'cognitive') return 'focus';
    const name = String(sport || '').toLocaleLowerCase('fr-CA');
    if (/badminton|tennis|pickleball/.test(name)) return 'racket';
    if (/ultimate/.test(name)) return 'disc';
    if (/basket|volley|soccer|futsal|handball|ballon|kin-ball/.test(name)) return 'ball';
    if (/course|musculation|condition|athlét|judo|lutte/.test(name)) return 'movement';
    return 'lesson';
  },
  icon(symbol) {
    return '<svg class="activityIcon" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><use href="henri-illustrations.svg#' + symbol + '"></use></svg>';
  },
  courseState(entry) {
    if (entry.kind === 'cognitive') return 'cognitiveCourse';
    return entry.annualPlan && entry.annualPlan !== 'À choisir' ? 'plannedCourse' : 'unplannedCourse';
  }
};
