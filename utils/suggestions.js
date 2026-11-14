import { getLastSessionPerMuscle, getVolumeByMuscle, getSessions } from './database';

const RECOVERY_DAYS = {
  Chest: 2, Back: 2, Shoulders: 2,
  Biceps: 1, Triceps: 1,
  Legs: 2, Glutes: 2, Calves: 1,
  Core: 1, Cardio: 0,
};

export async function getSuggestions() {
  const suggestions = [];

  try {
    const lastTrained = await getLastSessionPerMuscle();
    const volume = await getVolumeByMuscle(14);
    const sessions = await getSessions(10);

    const now = Date.now();
    const lastTrainedMap = {};
    for (const row of lastTrained) {
      lastTrainedMap[row.muscle] = row.last_trained;
    }

    // Days since each muscle was trained
    const musclesDue = [];
    for (const [muscle, recDays] of Object.entries(RECOVERY_DAYS)) {
      const last = lastTrainedMap[muscle];
      if (!last) {
        musclesDue.push({ muscle, daysSince: 999 });
      } else {
        const daysSince = Math.floor((now - last) / 86400000);
        if (daysSince >= recDays) {
          musclesDue.push({ muscle, daysSince });
        }
      }
    }
    musclesDue.sort((a, b) => b.daysSince - a.daysSince);

    // Suggest most overdue muscle groups
    const topDue = musclesDue.slice(0, 3);
    if (topDue.length > 0) {
      const muscleList = topDue.map(m => m.muscle).join(', ');
      suggestions.push({
        type: 'train',
        priority: 'high',
        icon: 'barbell',
        title: `Time to train ${topDue[0].muscle}`,
        body: `${topDue[0].daysSince === 999 ? 'Never trained' : `${topDue[0].daysSince} days ago`}. Consider a ${topDue.map(m => m.muscle).join(' + ')} session.`,
        muscles: topDue.map(m => m.muscle),
      });
    }

    // Rest day suggestion (3+ days in a row)
    if (sessions.length >= 3) {
      const last3 = sessions.slice(0, 3).map(s => new Date(s.started_at).toDateString());
      const today = new Date().toDateString();
      const yesterday = new Date(now - 86400000).toDateString();
      const twoDaysAgo = new Date(now - 172800000).toDateString();
      if (last3.includes(today) && last3.includes(yesterday) && last3.includes(twoDaysAgo)) {
        suggestions.push({
          type: 'rest',
          priority: 'medium',
          icon: 'moon',
          title: 'Consider a rest day',
          body: "You've trained 3 days in a row. Recovery is when muscles actually grow.",
          muscles: [],
        });
      }
    }

    // Muscle imbalance: push vs pull volume
    const volumeMap = {};
    for (const row of volume) volumeMap[row.muscle] = row.total_volume || 0;
    const pushVol = (volumeMap['Chest'] || 0) + (volumeMap['Shoulders'] || 0) + (volumeMap['Triceps'] || 0);
    const pullVol = (volumeMap['Back'] || 0) + (volumeMap['Biceps'] || 0);
    if (pushVol > 0 && pullVol > 0) {
      const ratio = pushVol / pullVol;
      if (ratio > 1.4) {
        suggestions.push({
          type: 'balance',
          priority: 'medium',
          icon: 'git-compare',
          title: 'Push/Pull imbalance detected',
          body: `Your push volume is ${Math.round(ratio * 100 - 100)}% higher than pull. Add more Back & Biceps work.`,
          muscles: ['Back', 'Biceps'],
        });
      } else if (ratio < 0.7) {
        suggestions.push({
          type: 'balance',
          priority: 'medium',
          icon: 'git-compare',
          title: 'Push/Pull imbalance detected',
          body: 'Your pull volume is significantly higher than push. Add more Chest & Shoulder work.',
          muscles: ['Chest', 'Shoulders'],
        });
      }
    }

    // Legs neglected
    const legVol = (volumeMap['Legs'] || 0) + (volumeMap['Glutes'] || 0);
    const upperVol = pushVol + pullVol;
    if (upperVol > 0 && legVol / upperVol < 0.3) {
      suggestions.push({
        type: 'balance',
        priority: 'low',
        icon: 'trending-up',
        title: 'Don\'t skip leg day',
        body: 'Lower body volume is significantly below upper body. Balance it out!',
        muscles: ['Legs', 'Glutes'],
      });
    }
  } catch (e) {
    console.warn('Suggestions error:', e);
  }

  return suggestions;
}
