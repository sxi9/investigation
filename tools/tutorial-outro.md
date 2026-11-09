## Where the files end up

- `docs/exports/` holds the STIX 2.1 bundle and the case JSON produced at step 13. Import the JSON through **Import** to get this exact board back.
- Everything else lives in your browser's `localStorage` under the key `cyber-investigation-board.v1`. Use **Encrypt** in the case bar to protect it with a passphrase.

## Adapting this to your own case

1. Start from the template that matches the incident (phishing, crypto theft, ransomware, insider, impersonation) or a blank board.
2. Paste every report you receive into **Extract IOCs** rather than typing indicators by hand; defanged values are recognised.
3. Give every card a **source** and a **stamp** as you go; the **Audit** tab lists what is still missing.
4. Keep the **key judgement** current and save a **snapshot** before each briefing so you can show what changed.
5. Send the **case brief** or **one-pager** to people, and the **STIX** bundle to tools.
