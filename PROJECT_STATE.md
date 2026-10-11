# PROJECT_STATE · LiveCap

## Current Focus
הקוד מוזג ל-`main` ועבר בדיקות (5/5). פרוס ב-Render: https://livecap-o95z.onrender.com (שירות `livecap`, Frankfurt, free, auto-deploy מ-`main`). הצעד הבא: בדיקה ב-Chrome באנדרואיד.

## משימות
- [x] `npm install` + `npm test` (5/5 עוברות)
- [x] `.gitignore` מכיל `node_modules`
- [x] העלאת הקוד ל-GitHub (ענף `claude/new-session-b35l4l`)
- [x] מיזוג ל-`main`
- [x] פריסה ב-Render (שירות web, Frankfurt) → https://livecap-o95z.onrender.com
- [ ] בדיקה ב-Chrome באנדרואיד + התקנה למסך הבית

## הערות
- השירות נוצר דרך ה-API של Render ולא דרך Blueprint, ולכן אין בו health check. אפשר להגדיר `/health` ב-Settings → Health Checks.

## רעיונות להמשך
- קוד QR להצטרפות, סיסמת חדר, שפות נוספות, שמירת תמלול
- ping ל-`/health` כדי להחזיק את Render ער
- החלפת `translate()` ל-DeepL / Claude API (דרך משתני סביבה)
