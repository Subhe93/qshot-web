# Technical Issues Report - QShot Web

---

## Issue #1: PDF Upload Failure (`net::ERR_HTTP2_PROTOCOL_ERROR`)

### Description

When uploading a PDF file to generate a dynamic QR code, the upload process fails and displays an error message ("فشل الرفع").

### Root Cause

The browser console registers a network failure on the `POST /upload-pdf` endpoint with `net::ERR_HTTP2_PROTOCOL_ERROR`. This occurs when the backend server or web proxy (e.g., Nginx or Node.js) forcibly terminates the connection due to file payload size restrictions or request timeouts on the HTTP/2 stream.

---

## Issue #2: Unrendered Placeholder Label (`<Label>`) in Static WiFi Form

### Description

In the Static WiFi QR Code creation form, a toggle switch component displays a raw, unparsed string literal `"<Label>"` instead of the intended UI text (such as "Hidden Network" / "شبكة مخفية").

### Root Cause

A hardcoded placeholder string, unpopulated component property, or missing internationalization (i18n) translation key is being passed directly to the label property of the toggle switch component.

---

## Issue #3: Telegram Username Validation Error (`Telegram Username غير صالح`)

### Description

In the Telegram QR Code creation form, entering a valid username ending with an `@` symbol (e.g., `Sbd778@`) triggers a validation error ("Telegram Username غير صالح"), preventing QR code generation.

### Root Cause

The frontend validation Regular Expression fails to account for trailing `@` characters or lacks string sanitization/normalization to automatically strip special characters before validating the input.

---

## Issue #4: HTTP 500 Server Error on Dynamic QR Code Target Redirection

### Description

Scanning generated Dynamic QR Codes (such as Form, App Download, PDF, Link, Google Review, WhatsApp, or Telegram) redirects to a URL route that throws an HTTP 500 Internal Server Error page instead of loading or redirecting to the intended dynamic content.

### Root Cause

* **Routing/Render Failures:** The server-side route responsible for parsing short-code URLs (e.g., `/q/[id]`) experiences unhandled runtime exceptions or missing template views for specific dynamic content types.


* **Database/Data Fetching Errors:** The API handling the redirection request fails when querying associated dynamic records or encounters unhandled null values for missing destination metadata.


* **Server-Side Rendering (SSR) Exceptions:** Missing environment variables or uncaught asynchronous errors occur during target lookup.



---

## Issue #5: Share Action Passes Plain URL Instead of QR Code Image Asset

### Description

Clicking the "Share" button for a generated QR code shares only the raw destination URL text instead of attaching or sharing the actual QR code image file (PNG/SVG) or card asset.

### Root Cause

The share handler relies on the Web Share API (`navigator.share`) or clipboard fallback by passing only text or URL parameters, omitting the file payload or binary image canvas data.

---

## Issue #6: Stale QR Code Preview Image & Stale PNG Export After Modification

### Description

Editing an existing QR code (such as changing design elements, colors, or logos) does not update the preview image on the user dashboard or during PNG export. The dashboard preview and exported files continue rendering the initial version created during the first save operation.

### Root Cause

* **Aggressive Client/CDN Caching:** The image preview URL generated during creation is cached by the browser or CDN, causing modified images with identical file paths to display stale cached versions.


* **Missing Thumbnail Regeneration:** The update API endpoint updates metadata in the database but fails to regenerate and overwrite the stored preview image asset on the storage server.


* **Frontend State Invalidation:** State management fails to trigger a re-render or invalidate cached image URLs upon saving edits.



---

## Issue #7: Direct File Download Prompt Missing on SVG & PNG Export

### Description

Selecting export options for SVG or PNG formats opens the QR code image in a new browser tab rather than directly triggering the browser's native file download prompt.

### Root Cause

* **Missing Download Attribute:** The export action navigates directly to the static image URL or Data URI without attaching the HTML5 `download` attribute or programmatically executing an anchor click.


* **Missing HTTP Response Headers:** Remote storage servers serve the file without the `Content-Disposition: attachment` header, causing browsers to display the image inline.



---

## Issue #8: Text Invisibility on Frame Containers Due to Contrast Failure

### Description

When generating or previewing specific frame styles (such as `banner`, `callout`, `clipboard`, `cloud`, `map`, `ribbon`, `split`, `tv`, and `stamp`), the text element inside the frame container becomes invisible against the frame background. The text area renders in a dark or solid black color while the text itself is simultaneously rendered in black fill, resulting in a solid black block.

### Root Cause

Hardcoded text color attributes (`fill: #000000`) and the absence of a dynamic contrast calculation mechanism to adjust text fill color relative to the active frame's background color.

---

## Issue #9: Optical Scan Failure on Dark / Custom Dark Backgrounds

### Description

QR codes created with dark background colors—including preset dark themes (`Neon`, `Midnight`, `Gold`, `Label`, `Badge`) or custom dark background selections—fail to scan on standard optical camera scanners and mobile devices.

### Root Cause

* **Contrast Inversion (ISO/IEC 18004 Non-Compliance):** Standard QR decoding algorithms require positive contrast where data modules are darker than the background canvas (`Data Modules < Background Luminance`). Light-colored modules over dark backgrounds fail standard image binarization thresholds during scanning.


* **Quiet Zone Disruption:** Optical readers locate QR codes using the corner finder patterns bounded by a light outer margin (Quiet Zone). Dark background canvases remove this perimeter boundary, preventing detection.

---
---

# حالة المعالجة — 2026-09-03 (فريق الويب)

| # | القضية | الحالة | التفصيل |
|---|---|---|---|
| 1 | فشل رفع PDF (HTTP2_PROTOCOL_ERROR) | ⛔ **باك اند** | الاتصال يُقطع من السيرفر/البروكسي (حد حجم الجسم أو مهلة على مسار `qr-code-dynamic/user/upload-pdf`). المطلوب من الباك اند: رفع `client_max_body_size` (أو ما يعادله) والتصريح بالحد الرسمي لنضيف فحصاً مسبقاً في الواجهة. |
| 2 | ليبل `<Label>` في توغل شبكة WiFi المخفية | ✅ **أُصلح دفاعياً** + ⚠️ باك اند | المصدر بيانات الكتالوج من السيرفر (حقل label يحمل placeholder حرفياً — التطبيق الموبايل سيعرضه أيضاً). الواجهة الآن تكشف أي ليبل بصيغة `<...>` أو فارغ وتسقط إلى التاج مؤنسناً ("Hidden"). **يُصحَّح جذرياً في بيانات الكتالوج**. |
| 3 | رفض يوزرنيم تيليغرام المنتهي بـ@ | ✅ **أُصلح** | قبل التحقق تُشذَّب كل النصوص وتُنزع @ الزائدة من طرفَي يوزرنيم تيليغرام (`Sbd778@` و`@Sbd778` = `Sbd778`). |
| 4 | خطأ 500 عند مسح QR الديناميكي (`qr.qshot.com/<id>`) | ⛔ **باك اند** | خدمة الرابط القصير بالكامل خادمية. ملاحظة مهمة للفريق: السجلات التجريبية محفوظة على قاعدة **speaknet** بينما الرابط المشفَّر يشير لـ`qr.qshot.com` — قد يكون الـ500 مجرد بحث عن سجل في القاعدة الخطأ أثناء الاختبار، إضافة لأي أعطال في المسار نفسه. |
| 5 | المشاركة ترسل الرابط لا صورة الـQR | ✅ **أُصلح** | زر المشاركة (البطاقة + صفحة التفاصيل) يشارك الآن **ملف PNG نفسه** عبر Web Share API (مع الرابط نصاً مرافقاً)، ويسقط للرابط فقط حين لا يدعم المتصفح مشاركة الملفات. |
| 6 | المعاينة والتصدير يعرضان النسخة القديمة بعد التعديل | ✅ **أُصلح سابقاً (2026-08-31)** — بانتظار النشر | مفاتيح S3 ثابتة عبر التعديلات بتصميم منصة v1، فكل روابط الصور صارت موسومة `?v=<updatedAt>` (البطاقات والتفاصيل والتحميل والمشاركة). إن استمر بعد النشر فالمشتبه الوحيد CDN يتجاهل الـquery string. |
| 7 | التصدير يفتح تاباً بدل التحميل | ✅ **أُصلح** | السبب: الـCDN بلا CORS ولا Content-Disposition ← فشل fetch كان يسقط لـwindow.open. أضيف بروكسي same-origin (`/api/qr-download`، مقفول على مسارات تخزين الـQR في cdn.qshot.com/cdn.speaknet.app) يبثّ الملف بترويسة attachment — التحميل يحصل دائماً. |
| 8 | نص الإطار غير مرئي (أسود على أسود) في banner/callout/…/stamp | ✅ **أُصلح** | لون الكابشن الافتراضي صار حسب الإطار: حبر داكن للإطارات ذات البطاقة الفاتحة (coupon, easel, envelope, label, mug, ornate, phone, script, ticket) وأبيض للـ18 الباقية؛ وتبديل الإطار يتبع الافتراضي الجديد ما لم يلمس المستخدم اللون. (نفس القياس المعتمد في مولّد مصغرات الموبايل.) |
| 9 | فشل مسح البريسِتات الداكنة (Neon/Midnight/Gold/…) | ⚠️ **قرار منتج — يُرفع لفريق الموبايل** | هذه البريسِتات منقولة حرفياً من كتالوج الموبايل نفسه، ومنصة الرندر تجيزها بلا تحذير (تباين ≥4.5:1). التحفظ العلمي صحيح (التباين المعكوس مخالف لـISO 18004 وبعض الماسحات القديمة تفشل فيه، مع أن كاميرات الهواتف الحديثة تتعامل معه غالباً). أي تعديل يجب أن يكون في كتالوج الموبايل المشترك (أو تحذير `invertedContrast` من المنصة) — لن نشقّ الويب عن الموبايل من طرف واحد. |

**التحقق**: tsc/eslint نظيفان، سكربت ثوابت العقد كله أخضر، البناء الإنتاجي ناجح.
