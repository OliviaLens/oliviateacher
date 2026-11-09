# GTM & GA4 setup – olivia.lenssens.net

Nov 4, 2026 · @Bernard

Set up GA4 first, because the GTM tags need its Measurement ID. Do this before, or right after, you deploy the `google-tag-manager` patch and set `GTM_ID` in Azure.

## Part 1 – Google Analytics 4

1. **Create the property.** In analytics.google.com, go to Admin → Create → Property.
   - Name: Olivia Lenssens
   - Time zone: Switzerland
   - Currency: Swiss franc (CHF)
   - Business objective: Generate leads
2. **Create the data stream.** Choose Web, enter `olivia.lenssens.net` and name it "Website". Copy the **Measurement ID (G-XXXXXXXXXX)**.
3. **Enhanced measurement.** In the stream, click the gear icon.
   - Keep page views, scrolls and outbound clicks on.
   - Turn **Form interactions off**: it would also count failed form sends; `generate_lead` replaces it.
   - Site search and video engagement can go off; the site has neither.
4. **Data retention.** Admin → Data collection and modification → Data retention → **14 months**.
5. **Google signals.** Leave it off unless you start running Google Ads.
6. **Custom dimensions.** Admin → Data display → Custom definitions → Create custom dimension. Create four, each with scope **Event** and the dimension name equal to the parameter name: `page_language`, `lead_service`, `booking_type`, `gallery_name`.
7. **Key events.** Admin → Data display → Key events → New key event. Add `generate_lead`, then `booking_scheduled`. Creating them by name works before the events have ever arrived.
8. **Optional: exclude your own visits.** In the stream, go to Configure tag settings → Define internal traffic and add your and Olivia's home IP. Then set the "Internal Traffic" filter to **Active** under Admin → Data filters.

## Part 2 – the GTM container

### A. Container

1. In tagmanager.google.com, create an account ("Olivia Lenssens") and a **Web** container (`olivia.lenssens.net`). Copy the **GTM-XXXXXXX** ID and set it in Azure: `az webapp config appsettings set -g olivia -n olivialenssens --settings GTM_ID=GTM-XXXXXXX`
2. Admin → Container Settings → tick **Enable consent overview**. The tags list then shows a shield icon to check each tag's consent settings.

### B. Variables

Variables → User-Defined Variables → New → **Data Layer Variable**. Create five, with the Data Layer Variable Name exactly as shown (version 2). Under Built-In Variables, make sure **Event** is ticked.

| Variable name | Data Layer Variable Name |
| --- | --- |
| DLV – page\_language | `page_language` |
| DLV – lead\_source | `lead_source` |
| DLV – lead\_service | `lead_service` |
| DLV – booking\_type | `booking_type` |
| DLV – gallery\_name | `gallery_name` |

### C. Triggers

Triggers → New → **Custom Event**:

| Trigger name | Event name | Regex |
| --- | --- | --- |
| CE – consent\_update | `consent_update` | No |
| CE – site events | `^(generate_lead\|booking_open\|booking_time_selected\|booking_scheduled\|gallery_open)$` | Yes (tick Use regex matching) |

Both fire on All Custom Events.

### D. Tag 1 – Google tag

- Tag type: **Google Tag**; Tag ID: your **G-XXXXXXXXXX**.
- Configuration settings → Configuration parameter: `page_language` = `{{DLV – page_language}}`. Every event, page views included, then carries the page language.
- Advanced Settings → Consent Settings → **Require additional consent for tag to fire** → add `analytics_storage`.
- Advanced Settings → Tag firing options → **Once per page**.
- Triggers: **Initialization – All Pages** and **CE – consent\_update**.

This is basic consent mode: nothing goes to Google until a visitor accepts statistics. On Accept, the `consent_update` trigger fires the tag at once and the page view is counted. Returning visitors who accepted are tracked from their first page, because the site restores their choice before GTM loads.

The alternative, advanced mode, leaves out the consent requirement and the `consent_update` trigger: Google then receives cookieless pings from visitors who refused and models their traffic. For a small Swiss/EU site, basic mode is the safer choice.

### E. Tag 2 – GA4 events

- Tag type: **Google Analytics: GA4 Event**; Measurement ID: the same **G-XXXXXXXXXX**.
- Event Name: `{{Event}}`
- Event Parameters (parameters an event doesn't have are left out):
  - `lead_source` = `{{DLV – lead_source}}`
  - `lead_service` = `{{DLV – lead_service}}`
  - `booking_type` = `{{DLV – booking_type}}`
  - `gallery_name` = `{{DLV – gallery_name}}`
- Consent Settings: require `analytics_storage`, as in tag 1.
- Trigger: **CE – site events**.

The events the site sends:

| Event | When | Parameters |
| --- | --- | --- |
| `generate_lead` | Contact form sent successfully | `lead_source`, `lead_service` |
| `booking_open` | A Pilates booking panel is opened | `booking_type` |
| `booking_time_selected` | A time is picked in Calendly | `booking_type` |
| `booking_scheduled` | A Calendly booking is confirmed | `booking_type` |
| `gallery_open` | A performance gallery is opened | `gallery_name` |
| `consent_update` | The visitor makes or changes a cookie choice | `consent_analytics`, `consent_marketing` |

## Test, then publish

1. In GTM, click **Preview** and enter `https://olivia.lenssens.net`. Tag Assistant opens the site.
2. Check:
   - [ ] The **Consent** tab shows everything *denied* on the first page, and the Google tag has not fired.
   - [ ] After **Accept all**, a `consent_update` event appears, consent shows *granted*, and the Google tag fires.
   - [ ] Opening a gallery, opening a Pilates booking panel and sending the contact form each fire the GA4 events tag.
   - [ ] After **Reject all** (in a fresh browser), nothing fires.
3. In GA4, Admin → **DebugView** shows the same events live while Preview is open.
4. Click **Submit**, name the version (for example "GA4 + consent"), then **Publish**.

Normal GA4 reports fill in within about 24 hours. The custom dimensions only show data collected after you created them.
