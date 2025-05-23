# VeracityAI Nexus

**An Intelligent Information Credibility Expert System with Dynamic Prolog Integration**

## 🔍 Overview

VeracityAI Nexus is a hybrid rule-based system combining the logical power of Prolog with the accessibility of a Node.js REST API. It enables dynamic ingestion, evaluation, and scoring of information based on custom criteria, aiming to enhance media reliability analysis and digital fact-checking.

## 🧠 Features

- 📥 Add information dynamically with metadata (source, author, style, etc.)
- 📊 Analyze existing information and get detailed reliability scores
- 🔎 Criteria-based scoring:
  - Source trustworthiness
  - Author reputation
  - Presence of citations
  - Language emotionality
  - Contradictions
- 📚 Persists new Prolog facts to a `.pl` file for future inference
- 🧾 Returns detailed explanations for transparency and interpretability

## 🚀 Getting Started

### Prerequisites

- Node.js (v14+)
- SWI-Prolog
- `projet.pl` file (knowledge base)

### 📦 Installation

```bash
git clone https://github.com/BoutlihHamza/VeracityAI-Nexus-Intelligent-Information-Credibility-Expert-System-with-Dynamic-Prolog-Integration.git
cd VeracityAI-Nexus-Intelligent-Information-Credibility-Expert-System-with-Dynamic-Prolog-Integration
npm install
