# êmet — AI-Powered Brand Governance Platform

> Your brand. Your standards. Consistently.

Live Demo: https://emet-six.vercel.app

Repository: https://github.com/TabithaStephen/emet

---

## Overview

êmet is an AI-powered brand governance and content intelligence platform designed to help businesses maintain brand consistency across marketing communications.

It transforms static brand guidelines into actionable rules that can be used to evaluate content, identify inconsistencies and improve brand-aligned communication.

By combining structured brand identity management, AI-powered content auditing and social media readiness evaluation, êmet helps users review content before publishing.

---

## Problem Statement

Businesses often struggle to maintain a consistent brand identity across multiple platforms, teams and marketing campaigns.

Although brand guidelines may exist as documents, applying them consistently to everyday content creation is difficult.

This can lead to:

- Inconsistent brand voice and tone
- Messaging that does not align with brand positioning
- Unapproved or unsupported claims
- Incorrect terminology
- Platform-inappropriate content
- Brand identity inconsistencies across marketing channels

êmet addresses this gap by making brand guidelines accessible, structured and actionable within a content evaluation workflow.

---

## Features

### 1. Brand DNA Studio

Create and manage structured brand identities, including:

- Brand identity and positioning
- Industry and brand description
- Target audience
- Brand voice and personality
- Tone of communication
- Messaging pillars
- Approved terminology
- Prohibited claims
- Approved facts
- Brand-specific rules

### 2. AI Audit Studio

Evaluate marketing content against selected brand guidelines using AI.

The audit helps identify:

- Brand voice inconsistencies
- Tone mismatches
- Messaging deviations
- Prohibited terminology
- Unsupported claims
- Content that conflicts with brand positioning

AI-generated findings and recommendations help users understand potential issues and improve their content.

### 3. Brand Guidelines PDF Import

Import brand guidelines from PDF documents.

AI extracts relevant information and proposes rules that users can review, edit and refine before applying them to their brand profile.

This reduces the manual effort of translating brand documentation into structured brand rules.

### 4. Social Media Content Readiness Checker

Evaluate content for social media platforms, including:

- Instagram
- LinkedIn
- Facebook

The checker helps assess platform suitability, content structure, messaging, tone and brand alignment before publication.

### 5. Audit History

Review previous audit results and track content review activity to support iterative content improvement.

### 6. Brand Workspace

Organize brand information and manage brand-specific content evaluation workflows.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js | Web application framework |
| React | UI development |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Google Gemini API | AI content evaluation and guideline extraction |
| Local Storage | Browser-side persistence |
| Vercel | Deployment and hosting |

---

## System Architecture

êmet uses a frontend-driven architecture integrated with an external AI service.

### Workflow

1. The user selects a brand and enters content.
2. The application retrieves the relevant brand context.
3. Application logic prepares the content and brand rules.
4. AI requests are processed using the Gemini API.
5. AI generates content evaluations or extracted guideline suggestions.
6. Results are returned to the application.
7. The user reviews findings and recommendations.
8. Supported data is stored in the browser for persistence.

### Architecture Overview

```text
                    USER
                     |
                     v
            êmet Web Application
             Next.js / React
                     |
                     v
        Brand Context & Application Logic
                     |
          +----------+-----------+
          |                    |
          v                    v
   Brand Rule Storage    AI Processing
   (Browser Storage)     (Gemini API)
          |                    |
          |                    v
          |             Content Analysis
          |             Guideline Extraction
          |                    |
          +----------+-----------+
                     |
                     v
             Results & Findings
                     |
                     v
               User Review
```

---

## Getting Started

These instructions allow developers to clone and run êmet locally.

### Prerequisites

