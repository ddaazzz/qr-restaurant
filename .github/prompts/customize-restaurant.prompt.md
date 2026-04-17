---
description: "Start a customization session for a specific restaurant. Sets context so all changes are scoped to one restaurant's branch."
agent: "restaurant-customizer"
argument-hint: "Restaurant name and what to customize"
---

I need to customize restaurant {{input}}.

First check which git branch we're currently on with `git branch --show-current`.

If we're on `main`, tell me we need to switch to or create the restaurant's branch first.

If we're on a `restaurant/` branch, check what recent customizations have been made with `git log --oneline -10`.

Then ask me what I'd like to customize.
