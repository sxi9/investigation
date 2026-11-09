## Outputs

- `docs/exports/case-04xx-safepay-ransomware-aa26-293a-triage.json` and `.stix.json`: the case and its STIX 2.1 bundle as exported at S22. Import the JSON to get the board back exactly; import the STIX bundle to see the round trip.
- `docs/exports/safepay-hostnames.csv`: the CSV used at S22 to show list import.
- `docs/case-safepay/evidence/`: the pictures uploaded to the cards.

## Reading the result

The finished board separates what CISA attributes to the actor (Bacloud C2, exfiltration hosts, the locker and soc.dll hashes, the five CVEs) from what is only context (CDN, GitHub and Google addresses that appear in the IOC table), carries the analyst's judgement with its dissent, and is signed off. The RFI to the hosting provider and the two overdue tasks are the open items; the Audit tab shows them until they are closed.
