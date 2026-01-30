// Mock expandChapters (Simplified for test)
console.log("System Timezone:", new Date().toString());
function expandChapters(chapterStr) {
  // Assume simple "Gen 1" or "Gen 1-3"
  // Just return a dummy array of length
  if (chapterStr.includes("-")) return ["1", "2", "3"]; 
  return ["1"];
}

// Mock Data
const plan = {
  totalDays: 365,
  startDate: "2024-01-01",
  schedule: [
    { day: 1, readings: [{ chapters: "Gen 1" }] },
    { day: 2, readings: [{ chapters: "Gen 2" }] },
    // ...
    { day: 29, readings: [{ chapters: "Gen 29" }] },
    { day: 30, readings: [{ chapters: "Gen 30" }] },
  ]
};

// Scenario: 
// User is in Korea (UTC+9). 
// Current Time: 2024-01-30 01:00:00 KST (Jan 29 16:00:00 UTC)
// User just read Day 30 reading.

// Server records it as Jan 29 (UTC).
const dailyStats = [
  { date: "2024-01-29", count: 1 } // Server sees Jan 29
];

// History records it as Jan 30 (Local from timestamp).
// 2024-01-30 01:00:00 KST is 2024-01-29T16:00:00Z
const history = [
  { 
    day: 30, 
    readingIndex: 0, 
    completedAt: "2024-01-29T16:00:00Z" 
  }
];

const progress = {
  history: history
};

// Target "Today" for the logic
// In Browser, startOfTodayLocal() would return Jan 30 00:00:00.
// We simulate this by forcing "today" to be Jan 30.
const today = new Date(2024, 0, 30); // Jan 30 2024 Local

// --- LOGIC FROM AchievementReportModal.tsx ---

const daysMap = new Map();
const last7Days = [];
const dateLabels = [];

for (let i = 6; i >= 0; i--) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const label = i === 0 ? "오늘" : `${d.getMonth() + 1}/${d.getDate()}`;
  last7Days.push(ymd);
  dateLabels.push(label);
  daysMap.set(ymd, 0);
}

// 1. History Logic
const daysWithHistory = new Set();
    
if (progress.history && progress.history.length > 0) {
  const readingWeights = new Map();
  // Mock weights
  readingWeights.set("30-0", 1); 

  progress.history.forEach(h => {
    if (!h.completedAt) return;
    
    const date = new Date(h.completedAt);
    if (isNaN(date.getTime())) return; 

    // Simulation of Local Time conversion
    // Node.js runs in system timezone. We need to be careful.
    // Ideally we assume the "system" running this script is the "client".
    // If I run this on a server, timezone is UTC.
    // If I run on my laptop, it is whatever.
    // To simulate Korea, I must shift the date manually or use specific UTC offsets.
    // But for the logic check, let's just use methods that return local values.
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const localYmd = `${y}-${m}-${d}`;

    console.log(`History Processing: UTC ${h.completedAt} -> Local ${localYmd}`);

    if (daysMap.has(localYmd)) {
      const key = `${h.day}-${h.readingIndex}`;
      const count = readingWeights.get(key) || 1;
      daysMap.set(localYmd, (daysMap.get(localYmd) || 0) + count);
      daysWithHistory.add(localYmd);
    }
  });
}

// 2. DailyStats Logic
dailyStats.forEach(ds => {
  const dateStr = ds.date.split('T')[0];
  console.log(`DailyStats Processing: ${ds.date} -> ${dateStr}`);
  
  // Here is the fix logic:
  if (daysMap.has(dateStr) && !daysWithHistory.has(dateStr)) {
     console.log(`  -> Merging DailyStats for ${dateStr}`);
     daysMap.set(dateStr, ds.count);
  } else {
     console.log(`  -> Skipping DailyStats for ${dateStr} (History exists or out of range)`);
  }
});

const weeklyCounts = last7Days.map(ymd => daysMap.get(ymd) || 0);

console.log("\n--- Results ---");
console.log("Last 7 Days (Local):", last7Days);
console.log("Weekly Counts:", weeklyCounts);
