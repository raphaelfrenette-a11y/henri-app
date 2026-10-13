/* Presentation only: reads existing application state, never changes persisted data. */
(() => {
  const next = document.getElementById('nextCourse');
  let dialogTrigger = null;
  let nextSlot = null;
  function setText(id, value) {
    const node = document.getElementById(id);
    if (node.textContent !== value) node.textContent = value;
  }
  function refresh() {
    const now = new Date();
    const today = getLocalTodayKey();
    nextSlot = null;
    for (const date of Object.keys(scheduleEntries).sort()) {
      if (date < today) continue;
      const entry = sortScheduleEntries(getVisibleScheduleEntries(date)).find(entry => {
        if (!isPlanningEntry(entry)) return false;
        if (date > today) return true;
        const start = scheduleTimeMinutes(entry.time);
        const end = entry.endTime ? scheduleTimeMinutes(entry.endTime) : start + (entry.durationMinutes || 70);
        return end > now.getHours() * 60 + now.getMinutes();
      });
      if (entry) { nextSlot = {date, entry, index: scheduleEntries[date].indexOf(entry)}; break; }
    }
    next.hidden = !nextSlot;
    if (nextSlot) {
      const {date, entry} = nextSlot;
      const inProgress = date === today && scheduleTimeMinutes(entry.time) <= now.getHours() * 60 + now.getMinutes();
      setText('nextCourseEyebrow', inProgress ? 'Cours en cours' : 'Prochain cours');
      const dateLabel = date === today ? 'Aujourd’hui' : new Intl.DateTimeFormat('fr-CA', {weekday:'long', day:'numeric', month:'long'}).format(new Date(date + 'T12:00:00'));
      setText('nextCourseWhen', dateLabel + ' · ' + entry.time + (entry.endTime ? ' – ' + entry.endTime : ''));
      setText('nextCourseGroup', entry.group);
      setText('nextCoursePlan', entry.annualPlan && entry.annualPlan !== 'À choisir' ? entry.annualPlan + (entry.session ? ' · ' + entry.session : '') : 'Séance à préparer');
    }
    document.querySelector('.homeActions').hidden = !groupsData.length;
    document.querySelectorAll('.planField label').forEach(label => {
      if (label.htmlFor) return;
      const control = label.parentElement.querySelector('input[id],select[id],textarea[id]');
      if (control) label.htmlFor = control.id;
    });
    document.querySelectorAll('.switch').forEach(button => {
      button.setAttribute('role','switch');
      button.setAttribute('aria-checked',String(button.classList.contains('on')));
      const label = button.closest('.teamOption,.detailRow')?.querySelector('strong,.detailLabel');
      button.setAttribute('aria-label',label?.textContent.trim() || 'Leader');
    });
    document.querySelectorAll('.attendanceChip').forEach(button => {
      button.setAttribute('aria-pressed',String(!button.classList.contains('absent')));
    });
    document.querySelectorAll('.teamCountBtn,.teamSegment button').forEach(button => button.setAttribute('aria-pressed',String(button.classList.contains('on'))));
    document.querySelectorAll('.rating button').forEach(button => {
      button.setAttribute('aria-pressed',String(button.classList.contains('on')));
      button.setAttribute('aria-label','Habileté ' + button.textContent + ' sur 5');
    });
    document.querySelectorAll('.henriBankUpload input,.henriBankPdfImport input').forEach(input => {
      input.hidden = false;
      if (!input.classList.contains('accessibleFile')) input.classList.add('accessibleFile');
      input.setAttribute('aria-label',input.closest('label').textContent.trim());
    });
  }
  document.getElementById('nextCourseOpen').addEventListener('click',() => {
    if (nextSlot) openCourseEntry(nextSlot.date, nextSlot.index);
  });
  function navigate(id) {
    refresh();
    const heading = document.querySelector('#' + id + ' h1, #' + id + ' h2');
    if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
  }
  const overlay = document.getElementById('teamGroupOverlay');
  const sheet = overlay.querySelector('.pickerSheet');
  sheet.setAttribute('role','dialog');
  sheet.setAttribute('aria-modal','true');
  sheet.setAttribute('aria-label','Choisir un groupe');
  overlay.querySelector('.pickerClose').setAttribute('aria-label','Fermer le choix du groupe');
  const main = document.getElementById('mainContent');
  const nav = document.querySelector('.bottom');
  const header = document.querySelector('.top');
  new MutationObserver(() => {
    const open = overlay.classList.contains('show');
    // The dialog lives inside main: make sibling sections and controls inert.
    main.querySelectorAll('.screen').forEach(section => {
      if (section.id !== 'teamBuilder') section.inert = open;
    });
    document.querySelectorAll('#teamBuilder > :not(.pickerOverlay)').forEach(node => node.inert = open);
    nav.inert = open; header.inert = open;
    document.getElementById('teamGroupPicker').setAttribute('aria-expanded',String(open));
    if (open) { dialogTrigger = document.activeElement; sheet.querySelector('.pickerChoice.on,.pickerClose')?.focus(); }
    else if (dialogTrigger) { dialogTrigger.focus(); dialogTrigger = null; }
  }).observe(overlay,{attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',event => {
    if (!overlay.classList.contains('show')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeTeamGroupPicker(); }
    if (event.key === 'Tab') {
      const controls = [...sheet.querySelectorAll('button:not(:disabled)')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  let frame = null;
  const observer = new MutationObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => { frame = null; refresh(); });
  });
  observer.observe(main,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.HenriUX = {refresh,navigate};
  refresh();
  // Re-evaluate the next course when returning to the app after a class.
  document.addEventListener('visibilitychange',() => { if (!document.hidden) refresh(); });
  setInterval(refresh,60000);
})();
