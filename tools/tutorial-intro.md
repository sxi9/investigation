# Worked investigation: vendor-themed Okta / ServiceNow vishing wave

This walkthrough builds a real, recent case on the board from nothing, one step at a time, and shows which control to use at each step. Every screenshot was captured from the running app; yellow numbers mark the controls mentioned in the text.

## The event

On 19 October 2026 Dataminr's threat research team (TRACE) published an intel brief on an **Okta-themed phishing campaign against e-commerce providers**. The essentials, as reported:

- **Who is hit:** B2B e-commerce SaaS and infrastructure providers: marketing and customer-engagement platforms, logistics partners, payment and fraud-prevention providers. Several were targeted more than once. The assessed motive is downstream third-party breach leverage for data extortion.
- **How it works:** look-alike Okta and ServiceNow SSO portals on domains that pair a vendor name with "okta" or "servicenow" (for example `gladly-okta[.]com`, `shipmonk-servicenow[.]com`). The pages back up **voice phishing**: the caller walks the user through an **MFA downgrade**, getting past YubiKey hardware keys wherever policy still allows an SMS or email code as a fallback.
- **When:** domain registration waves since late July 2026; the e-commerce targeting pattern from September; `riskified-okta[.]com` and `shipmonk-servicenow[.]com` registered 18 October, `gladly-okta[.]com` about 20 hours later.
- **Who:** linked with high confidence to earlier English-language cybercrime activity with the same targeting. No group is named.
- **Indicators (13 domains):** gladly-okta[.]com, riskified-okta[.]com, shipmonk-servicenow[.]com, yotpo-okta[.]com, paddleokta[.]com, moengageinc-okta[.]com, vzw-web-portal[.]com, listrak-okta[.]com, oktadialpad[.]com, servicenow-ticket2478[.]com, servicenow-ticket2829[.]com, servicenow-ticket[.]com, attentive-okta[.]com.

Source: Dataminr TRACE, [Okta-Themed Phishing Campaign Targets E-commerce Providers](https://www.dataminr.com/resources/intel-brief/okta-themed-phishing-campain-targets-e-commerce-providers/), 19 October 2026. Only facts from that brief are used below; nothing is attributed beyond it.

## What you will do

1. Start a case from the **Phishing campaign** template.
2. Pin the source and pull all 13 domains out of the report with **Extract IOCs**.
3. Edit the operator and target cards; delete placeholders you do not need.
4. Add ATT&CK techniques, dated events and analyst notes with **quick add**.
5. Arrange the board by dragging.
6. **Connect** the evidence with threads and record why each link exists.
7. Pivot on a domain in the **OSINT workbench**.
8. **Stamp and grade** the key indicators; add follow-up tasks.
9. Test the hypotheses in **ACH**.
10. Write the **key judgement**, save a snapshot, move the case to review.
11. Read the case as a **timeline** and as **kill-chain lanes**.
12. Generate a **takedown request**.
13. Export the **case brief**, a **STIX bundle** and the **case JSON**.

Each step below names the control, what to type, and what you should see.

## Steps

