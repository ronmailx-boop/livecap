# LiveCap · תרגום חי · רוסית ← עברית

מדברים ברוסית, והתרגום לעברית נכתב מיד על המסך. הכל באפליקציה אחת.

כתובת: https://livecap.vplusstudio.app

גיבוי: https://livecap-o95z.onrender.com

## איך זה עובד
1. פותחים את האפליקציה בכרום ולוחצים על המיקרופון.
2. הדפדפן מזהה דיבור ברוסית (Web Speech API, חינמי).
3. השרת מתרגם לעברית (Google translate endpoint, עם MyMemory כגיבוי) ומחזיר את התרגום.
4. התרגום מופיע בגדול, והמקור ברוסית מתחתיו (אפשר להסתיר). אפשר להגדיל ולהקטין את הטקסט ולנקות את המסך.

## פריסה
- **Cloudflare (ראשי):** `wrangler.jsonc` + `worker/index.js`. כל push ל-`main` מפעיל את `.github/workflows/deploy-cloudflare.yml`. צריך Secret בשם `CLOUDFLARE_API_TOKEN` בריפו; בלעדיו הפריסה מדלגת.
- **Render (גיבוי):** שירות web חינמי, `render.yaml` מגדיר אותו.
- אין משתני סביבה ואין מפתחות API. לוגיקת התרגום ב-`translate.js`, משותפת לשניהם.

## הערות
- ב-Render החינמי השרת נרדם אחרי חוסר פעילות (ב-Cloudflare לא).
- זיהוי הדיבור עובד ב-Chrome (אנדרואיד ודסקטופ). ב-Safari/Firefox התמיכה חלקית או חסרה.
- נקודות הקצה החינמיות לתרגום אינן רשמיות ועלולות להיחסם בעומס. אם צריך יציבות, מחליפים את `translate()` ב-`translate.js` ל-DeepL או ל-Claude API.

## בדיקה מקומית
```
npm install
npm test
npm start
```
