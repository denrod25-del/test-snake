// Achievement badges — evaluated client-side against progress.
// Unlock is idempotent (once in Set, stays).

window.BADGES = [
  { id: 'first-lesson', icon: '🌱', title: 'First steps', desc: 'Complete any lesson',
    test: (s) => s.completed.size >= 1 },
  { id: 'foundation-done', icon: '🧱', title: 'Foundation built', desc: 'Finish every Foundation lesson',
    test: (s) => {
      const m = CURRICULUM.find(x => x.id === 'foundation');
      return m && m.lessons.every(l => s.completed.has(`foundation/${l.id}`));
    } },
  { id: 'architect', icon: '🏛', title: 'Systems thinker', desc: 'Complete Architecture module',
    test: (s) => {
      const m = CURRICULUM.find(x => x.id === 'architecture');
      return m && m.lessons.every(l => s.completed.has(`architecture/${l.id}`));
    } },
  { id: 'cloud-hand', icon: '☁', title: 'Cloud hands-on', desc: 'Complete Cloud module',
    test: (s) => {
      const m = CURRICULUM.find(x => x.id === 'cloud');
      return m && m.lessons.every(l => s.completed.has(`cloud/${l.id}`));
    } },
  { id: 'designer', icon: '📐', title: 'Designer mode', desc: 'Complete System Design module',
    test: (s) => {
      const m = CURRICULUM.find(x => x.id === 'system');
      return m && m.lessons.every(l => s.completed.has(`system/${l.id}`));
    } },
  { id: 'positioned', icon: '⚡', title: 'Visible engineer', desc: 'Complete Positioning module',
    test: (s) => {
      const m = CURRICULUM.find(x => x.id === 'positioning');
      return m && m.lessons.every(l => s.completed.has(`positioning/${l.id}`));
    } },
  { id: 'six-fig-path', icon: '💼', title: 'Career map', desc: 'Complete Six-Figure Roles module',
    test: (s) => {
      const m = CURRICULUM.find(x => x.id === 'roles');
      return m && m.lessons.every(l => s.completed.has(`roles/${l.id}`));
    } },
  { id: 'scholar', icon: '🎓', title: 'Scholar', desc: 'Complete every lesson in the course',
    test: (s) => {
      const total = CURRICULUM.reduce((n, m) => n + m.lessons.length, 0);
      return s.completed.size >= total;
    } },
  { id: 'challenge-5', icon: '⚔', title: 'Warmed up', desc: 'Solve 5 coding challenges',
    test: (s) => s.challengesDone.size >= 5 },
  { id: 'challenge-all', icon: '🏆', title: 'Arena cleared', desc: 'Solve every coding challenge',
    test: (s) => s.challengesDone.size >= CHALLENGES.length },
  { id: 'review-10', icon: '🧠', title: 'Memory athlete', desc: 'Review 10 flashcards in Review mode',
    test: (s) => (s.reviewCountTotal || 0) >= 10 },
  { id: 'streak-7', icon: '🔥', title: 'Week warrior', desc: '7-day learning streak',
    test: (s) => (s.streak && s.streak.count >= 7) },
  { id: 'project-ship', icon: '🚀', title: 'Shipper', desc: 'Finish the build-along project',
    test: (s) => {
      const p = PROJECTS[0];
      if (!p) return false;
      return p.steps.every(st => s.projectStepsDone.has(`${p.id}/${st.id}`));
    } },
  { id: 'capstone-1', icon: '✅', title: 'Job signal I', desc: 'Check off 10 capstone items across modules',
    test: (s) => (s.capstoneItems && s.capstoneItems.size >= 10) },
];
