---
{
  "version": 1,
  "layout": "paper",
  "slug": "bara-lev-turrini-communities-voting",
  "title": "תאי הד וריבוי מפלגות: גבולות החיזוי של הצבעה ברשתות חברתיות",
  "titleHe": "תאי הד וריבוי מפלגות: גבולות החיזוי של הצבעה ברשתות חברתיות",
  "descriptionHe": "Jacques Bara, עומר לב ו-Paolo Turrini בוחנים בסימולציות אם מדד של פער השפעה ברשת מנבא תוצאות הצבעה גם בנוכחות קהילות ותאי הד. כאשר הרשת מחולקת לקהילות, ספירה פשוטה של התמיכה הראשונית מנבאת לעיתים טוב יותר, ובייחוד בתחרות מרובת מפלגות. הממצאים מדגישים שהצלחת מדד תלויה במבנה החברתי שבו הוא נבדק.",
  "summaryHe": "Jacques Bara, עומר לב ו-Paolo Turrini בוחנים בסימולציות אם מדד של פער השפעה ברשת מנבא תוצאות הצבעה גם בנוכחות קהילות ותאי הד. כאשר הרשת מחולקת לקהילות, ספירה פשוטה של התמיכה הראשונית מנבאת לעיתים טוב יותר, ובייחוד בתחרות מרובת מפלגות. הממצאים מדגישים שהצלחת מדד תלויה במבנה החברתי שבו הוא נבדק.",
  "subtitleHe": "",
  "oneLinerHtml": "<strong>מדד השפעה שמצליח ברשת אחת עלול לאבד כוח חיזוי ברשת המחולקת לקהילות.</strong> בדיקה מול התמיכה הראשונית היא תנאי להבנת התוספת שמספק ניתוח הרשת.",
  "paperTitle": "Predicting voting outcomes in the presence of communities, echo chambers and multiple parties",
  "authorsCardHe": "Jacques Bara, עומר לב, Paolo Turrini",
  "authorsHtml": "<a href=\"https://warwick.ac.uk/fac/sci/mathsys/people/students/mathsysii/bara/\" target=\"_blank\" rel=\"noopener noreferrer\">Jacques Bara</a>, <a href=\"https://www.bgu.ac.il/people/omerlev/\" target=\"_blank\" rel=\"noopener noreferrer\">עומר לב</a>, <a href=\"https://warwick.ac.uk/fac/sci/dcs/people/paolo_turrini/\" target=\"_blank\" rel=\"noopener noreferrer\">Paolo Turrini</a>",
  "authors": [
    {
      "@type": "Person",
      "name": "Jacques Bara",
      "url": "https://warwick.ac.uk/fac/sci/mathsys/people/students/mathsysii/bara/"
    },
    {
      "@type": "Person",
      "name": "Omer Lev",
      "url": "https://www.bgu.ac.il/people/omerlev/"
    },
    {
      "@type": "Person",
      "name": "Paolo Turrini",
      "url": "https://warwick.ac.uk/fac/sci/dcs/people/paolo_turrini/"
    }
  ],
  "sourceAuthors": [
    {
      "@type": "Person",
      "name": "Jacques Bara",
      "url": "https://warwick.ac.uk/fac/sci/mathsys/people/students/mathsysii/bara/"
    },
    {
      "@type": "Person",
      "name": "Omer Lev",
      "url": "https://www.bgu.ac.il/people/omerlev/"
    },
    {
      "@type": "Person",
      "name": "Paolo Turrini",
      "url": "https://warwick.ac.uk/fac/sci/dcs/people/paolo_turrini/"
    }
  ],
  "journal": "Artificial Intelligence 312, article 103773",
  "dateText": "נובמבר 2022",
  "doiUrl": "https://doi.org/10.1016/j.artint.2022.103773",
  "doiLabel": "10.1016/j.artint.2022.103773",
  "topics": [
    "public-opinion-polarization-violence",
    "institutions-civil-society-public-service"
  ],
  "keywords": [
    "תאי הד",
    "רשתות חברתיות",
    "חיזוי בחירות",
    "הומופיליה",
    "ריבוי מפלגות"
  ],
  "image": {
    "src": "html_qa/bara-lev-turrini-communities-voting.jpg",
    "version": "2026-10-09-nightly-003819",
    "altHe": "סצנה בדיונית שנוצרה בבינה מלאכותית: קבוצות שיחה בבית קפה ואדם הנע ביניהן",
    "fitness": "standard",
    "creator": "OpenAI",
    "sourceType": "generated",
    "provider": "OpenAI",
    "license": "AI-generated image",
    "fitnessSource": "paper_specific_editorial_review"
  },
  "datePublished": "2026-10-09",
  "dateModified": "2026-10-09",
  "lastUpdatedHe": "9 באוקטובר 2026",
  "file": "bara-lev-turrini-communities-voting.html",
  "permalink": "/bara-lev-turrini-communities-voting.html",
  "paper_url": "bara-lev-turrini-communities-voting.html",
  "sortKey": 202610090009,
  "order": 202610090009,
  "summarySourceStatus": "Based on full text",
  "sourceAvailable": true,
  "sourceVerified": true,
  "hasFullText": true,
  "sourceStatus": "full_text",
  "sourceKind": "accepted_manuscript",
  "sourceUrl": "https://wrap.warwick.ac.uk/168268/1/WRAP-Predicting-voting-outcomes-presence-communities-echo-chambers-multiple-22.pdf",
  "sections": [
    {
      "headingHe": "הקהילה משנה את מבחן החיזוי",
      "paragraphsHtml": [
        "קשרים חברתיים אינם מתפזרים בהכרח באופן אחיד בין כל האנשים. המחקר בונה רשתות עם קהילות ועם רמות שונות של דמיון פוליטי בין מקושרים, ובודק כיצד מאפיינים אלה משפיעים על חיזוי הצבעה. הוא מרחיב את ההשוואה מתחרות בין שתי מפלגות גם למספר גדול יותר של מפלגות."
      ]
    },
    {
      "headingHe": "מושגי יסוד בקצרה",
      "paragraphsHtml": [
        "<strong>הומופיליה</strong> היא נטייה של אנשים דומים להיות מקושרים זה לזה. תא הד הוא סביבה שבה אדם נחשף שוב ושוב לעמדות דומות לשלו, ואילו קהילה ברשת היא קבוצת צמתים שמקושרים ביניהם בצפיפות יחסית. מושגים אלה קשורים, אך קהילה צפופה אינה חייבת להיות אחידה בעמדותיה."
      ]
    },
    {
      "headingHe": "מהו פער ההשפעה שנבדק במאמר?",
      "paragraphsHtml": [
        "זהו מדד המבקש לתאר יתרון יחסי של מחנה במבנה החשיפה וההשפעה ברשת. הוא מתייחס למיקומם של תומכים ולסביבתם החברתית, מעבר למספרם הכולל. המאמר בוחן אם היתרון המבני הזה ממשיך לנבא את התוצאה כאשר מוסיפים קהילות."
      ]
    },
    {
      "headingHe": "איך נוצרו הרשתות ששימשו לבדיקה?",
      "paragraphsHtml": [
        "המחברים הרחיבו משפחה של רשתות המורכבות מקבוצות צפופות עם קשרים ביניהן. הם שינו את הקשר בין דעות לבין חיבורים כדי לייצג רמות שונות של הומופיליה. כך אפשר להשוות תנאים חברתיים שונים בתוך מסגרת חישובית מבוקרת."
      ]
    },
    {
      "headingHe": "האם המחקר משתמש בתוצאות של בחירות ארציות?",
      "paragraphsHtml": [
        "הבדיקה המרכזית מבוססת על סימולציות של שינוי עמדות והצבעה ברשתות שנוצרו לצורך המחקר. היא מאפשרת לבחון מנגנונים ויכולת חיזוי בתנאים מוגדרים. היא אינה אימות של המודל על סדרת בחירות ארציות בעולם האמיתי."
      ]
    },
    {
      "headingHe": "מה נמצא כאשר אין רוב ראשוני ברור?",
      "paragraphsHtml": [
        "ברשתות הקהילתיות שנבדקו, פער ההשפעה לא היה מנבא טוב כאשר לא היה יתרון ראשוני ברור למחנה. הממצא מראה שמבנה קהילתי יכול לשנות את התועלת של מדד שנראה מבטיח בהקשרים אחרים. יש לכן לבדוק את המדד מחדש כשמשנים את מבנה הרשת."
      ]
    },
    {
      "headingHe": "איך פעלה ספירת התומכים בתחילת הסימולציה?",
      "paragraphsHtml": [
        "כאשר אפשרו גדלים שונים של רוב התחלתי, ספירת התמיכה הראשונית ניבאה את התוצאה טוב יותר מפער ההשפעה לבדו. היתרון הופיע ברמות שונות של הומופיליה במסגרת שנבדקה. נקודת הייחוס הפשוטה חיונית כדי לדעת אם המדד המורכב אכן מוסיף מידע."
      ]
    },
    {
      "headingHe": "האם שילוב מדדים שיפר את החיזוי?",
      "paragraphsHtml": [
        "בכמה רמות של הומופיליה, שילוב פער ההשפעה עם ספירת הקולות הראשונית שיפר את כוח החיזוי. לכן המסקנה אינה שלמבנה הרשת אין כל ערך. השאלה היא איזה מידע הוא מוסיף מעבר למה שכבר ידוע על התפלגות התמיכה."
      ]
    },
    {
      "headingHe": "מה השתנה בתחרות עם יותר משתי מפלגות?",
      "paragraphsHtml": [
        "המחברים הציעו הרחבות של פער ההשפעה למספר מפלגות ובחנו את ביצועיהן. בסימולציות מרובות המפלגות התחזק היתרון היחסי של ספירת התמיכה הראשונית. תוצאה זו מזהירה מפני העברה אוטומטית של מדד שנבנה לתחרות דו-מפלגתית."
      ]
    },
    {
      "headingHe": "האם תאי הד תמיד משנים את זהות המנצח?",
      "paragraphsHtml": [
        "המחקר אינו מציג כלל שלפיו תא הד מבטיח ניצחון למחנה מסוים. השפעת המבנה תלויה בהעדפות ההתחלתיות, בחיבורים ובדינמיקה שהמודל מניח. גם יכולת נמוכה של מדד לנבא אינה מוכיחה שלתהליך החברתי עצמו אין השפעה."
      ]
    },
    {
      "headingHe": "אילו תופעות אינן נבחנות במלואן במסגרת הזו?",
      "paragraphsHtml": [
        "המחברים מצביעים על אפשרויות להרחבה, ובהן מבני השפעה מורכבים יותר והתנהגות אסטרטגית או מניפולטיבית. עצם אזכורן של תופעות כאלה אינו מדידה של השפעת בוטים או של קמפיין מסוים. יישום על מערכת ממשית דורש לבדוק אילו הנחות במודל מתקיימות בה."
      ]
    },
    {
      "headingHe": "מה המשמעות להערכת תחזיות על בסיס רשתות חברתיות?",
      "paragraphsHtml": [
        "תחזית צריכה להיבחן מול חלופה פשוטה ובכמה סוגים של מבנה חברתי. המחקר מראה שהצלחת מדד בתנאי רשת מסוימים אינה מבטיחה שיצליח כשמוסיפים קהילות או מפלגות. הערכה כזו מסייעת להבחין בין הסבר מעניין של השפעה חברתית לבין כלי חיזוי שימושי."
      ]
    }
  ]
}
---
