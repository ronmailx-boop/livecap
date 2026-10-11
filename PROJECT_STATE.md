# PROJECT_STATE · LiveCap

## Current Focus
העלאה ל-Cloudflare בכתובת livecap.vplusstudio.app (Worker עם התרגום). הצעד הבא: המשתמש יוצר API Token ושומר אותו כ-Secret `CLOUDFLARE_API_TOKEN` בריפו, ואז מפעילים את ה-workflow ובודקים בטלפון.

## משימות
- [x] `npm install` + `npm test` (5/5 עוברות)
- [x] `.gitignore` מכיל `node_modules`
- [x] העלאת הקוד ל-GitHub (ענף `claude/new-session-b35l4l`)
- [x] מיזוג ל-`main`
- [x] פריסה ב-Render (שירות web, Frankfurt) → https://livecap-o95z.onrender.com
- [x] health check `/health` ב-Render (אומת)
- [x] מסך אחד: מיקרופון + תרגום באותה אפליקציה (הוסרו חדרים, דובר/מאזין, WebSocket) — פרוס ב-Render
- [x] בדיקה בטלפון (Chrome באנדרואיד) — עובד (11.10.2026)
- [x] עיצוב dark mode במקום הסגול (style.css, index.html, manifest, אייקונים)
- [x] בדיקת העיצוב החדש בטלפון — עובד (11.10.2026)
- [x] קבצי Cloudflare: `wrangler.jsonc`, `worker/index.js`, `translate.js` משותף, workflow
- [ ] Secret `CLOUDFLARE_API_TOKEN` בריפו (המשתמש)
- [ ] פריסה ל-Cloudflare ואימות livecap.vplusstudio.app בטלפון

## הערות
- auto-deploy מ-`main` לא הופעל אחרי מיזוג PR #2 (11.10.2026); הפריסה הופעלה ידנית. כנראה ש-Render לא מחובר לריפו דרך ה-GitHub App. לבדוק ב-Render → Settings → Build & Deploy.
- השירות נוצר דרך ה-API של Render ולא דרך Blueprint. ה-health check (`/health`) הוגדר ידנית בדשבורד ואומת.

## רעיונות להמשך
- שפות נוספות, שמירת/העתקת תמלול
- החלפת `translate()` ל-DeepL / Claude API (דרך משתני סביבה)
