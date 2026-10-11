# PROJECT_STATE · LiveCap

## Current Focus
האפליקציה הפכה למסך אחד: מיקרופון ← תרגום לעברית מיד מתחת (בלי חדרים, בלי דובר/מאזין). הצעד הבא: בדיקה בטלפון ב-Chrome באנדרואיד עם דיבור אמיתי ברוסית.

## משימות
- [x] `npm install` + `npm test` (5/5 עוברות)
- [x] `.gitignore` מכיל `node_modules`
- [x] העלאת הקוד ל-GitHub (ענף `claude/new-session-b35l4l`)
- [x] מיזוג ל-`main`
- [x] פריסה ב-Render (שירות web, Frankfurt) → https://livecap-o95z.onrender.com
- [x] health check `/health` ב-Render (אומת)
- [x] מסך אחד: מיקרופון + תרגום באותה אפליקציה (הוסרו חדרים, דובר/מאזין, WebSocket) — פרוס ב-Render
- [ ] בדיקה ב-Chrome באנדרואיד + התקנה למסך הבית

## הערות
- auto-deploy מ-`main` לא הופעל אחרי מיזוג PR #2 (11.10.2026); הפריסה הופעלה ידנית. כנראה ש-Render לא מחובר לריפו דרך ה-GitHub App. לבדוק ב-Render → Settings → Build & Deploy.
- השירות נוצר דרך ה-API של Render ולא דרך Blueprint. ה-health check (`/health`) הוגדר ידנית בדשבורד ואומת.

## רעיונות להמשך
- שפות נוספות, שמירת/העתקת תמלול
- ping ל-`/health` כדי להחזיק את Render ער
- החלפת `translate()` ל-DeepL / Claude API (דרך משתני סביבה)
