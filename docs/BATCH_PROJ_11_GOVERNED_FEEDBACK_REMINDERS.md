# PROJ-11 — Governed Feedback Reminders

Status: **implemented**

Adds a manual, audited email reminder for an already delivered and still-active feedback link. Every reminder prepares a new server-side token hash, keeps the previous link active while email delivery is pending, and rotates to the new link only after the provider accepts the message. Reminders require 72 hours between contacts, stop after three successful reminders, reject concurrent sends, and are blocked after feedback receipt. Provider failures are recorded while the previous link remains active. Automatic scheduling, WhatsApp, retries, and n8n remain outside this batch.
