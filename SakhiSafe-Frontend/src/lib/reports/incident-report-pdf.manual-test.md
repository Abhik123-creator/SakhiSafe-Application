# Incident Report PDF Manual Verification

Manual sample export target:

- URL: `http://localhost:3000/dashboard/incidents/78cd2322-b36f-4c71-8740-4d57cbbcaa1a`
- Action: open the incident detail page and click `Download PDF`.

Expected review checks:

- Page 1 shows the SakhiSafe header, confidentiality notice, critical risk snapshot, and readable incident summary.
- Main sections avoid raw UUID-heavy field dumps; full internal IDs are limited to the appendix.
- Conversation messages render as readable timeline cards with human labels.
- Evidence image, caption, privacy note, and AI observation summary stay visually close together.
- Failed or low-confidence image analysis is shown once as a human-review limitation, not repeated raw text.
- Footer and page number appear consistently.
