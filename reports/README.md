# Reports Index

Index of all Phase 2 and Phase 1 deliverables, plans, technical reports, and verification documents in `reports/`.

---

## Start Here (Final Deliverables)

- **Combined Full Report (PDF):** [Combined Phase 1 & Phase 2 IEEE Paper](combined_traffic_flow_paper_phase1_phase2.pdf) (10 pages total)
- **Live Interactive Demo:** [METR-LA Forecast Lab](https://traffic-flow-two.vercel.app/) (3D Los Angeles map, model walkthroughs, hypotheses & signal simulation)

### Phase 2
- [Phase 2 IEEE Paper (PDF)](paper_phase2/phase2_ieee_paper.pdf) · [LaTeX / Overleaf Bundle (ZIP)](paper_phase2/phase2_ieee_source.zip) · [Presentation Slides (PPTX)](paper_phase2/phase2_slides.pptx)
- [Phase 2 Synthesis & Viva Guide](phase2/person_e_phase2_report.md)

### Phase 1
- [Phase 1 IEEE Paper (PDF)](paper/phase1_ieee_paper.pdf) · [LaTeX / Overleaf Bundle (ZIP)](paper/phase1_ieee_source.zip)
- [Phase 1 Final Report (Person E)](person_e_report.md)

---

## Phase 2 Documentation (`phase2/` & `phase2_plan.md`)

- [phase2_plan.md](phase2_plan.md) — Master Phase 2 plan & contracts *(kept at top level because code/scripts reference it)*
- [phase2/person_e_phase2_report.md](phase2/person_e_phase2_report.md) — Phase 2 synthesis, headline results, and viva Q&A
- [phase2/pipeline.md](phase2/pipeline.md) — Member 1 core pipeline & training contract
- [phase2/fact_sheet_gat.md](phase2/fact_sheet_gat.md) — Member 2 GAT architecture, parameter counts, and runtime notes
- [phase2/fact_sheet_dcrnn_controls.md](phase2/fact_sheet_dcrnn_controls.md) — Member 3 DCRNN & `gru_local` architecture and controls
- [phase2/fact_sheet_evaluation.md](phase2/fact_sheet_evaluation.md) — Member 4 evaluation harness, bootstrap, and figures
- [phase2/qa_claims_checklist.md](phase2/qa_claims_checklist.md) — Member 5 QA & claims verification checklist
- [phase2/reproduction.md](phase2/reproduction.md) — Clean-clone reproduction commands & measured timings
- [phase2/handover_to_team.md](phase2/handover_to_team.md) — Historical pre-training team handover *(all steps completed)*
- [paper_phase2/](paper_phase2/README.md) — Generated IEEE conference paper (`phase2_ieee_paper.tex`), slides, [figures/](paper_phase2/figures/), `paper_content.json`, and `qa_report.json`

---

## Phase 1 Documentation (Frozen at tag `phase1-final`)

> Note: Phase 1 files are kept at their original paths so `scripts/phase2_check_phase1_frozen.py` passes cleanly.

### Paper (`paper/`)
- [paper/README.md](paper/README.md) · [phase1_ieee_paper.pdf](paper/phase1_ieee_paper.pdf) · [phase1_ieee_paper.tex](paper/phase1_ieee_paper.tex) · [phase1_ieee_source.zip](paper/phase1_ieee_source.zip) · [figures/](paper/figures/)

### Synthesis & Verification
- [phase1_synthesis_report.md](phase1_synthesis_report.md)
- [phase1_completion_verification.md](phase1_completion_verification.md)
- [verification.md](verification.md)
- [phase2_graph_gap_analysis.md](phase2_graph_gap_analysis.md)

### Member Reports & Viva Guide
- [person_c_report.md](person_c_report.md)
- [person_d_report.md](person_d_report.md)
- [person_e_report.md](person_e_report.md)
- [person_e_viva_guide.md](person_e_viva_guide.md)

### Historical Plans & Handoffs
- [person_a_plan.md](person_a_plan.md)
- [person_b_handoff.md](person_b_handoff.md)
- [person_c_d_handoff.md](person_c_d_handoff.md)
- [person_c_e_handoff.md](person_c_e_handoff.md)
- [person_e_plan.md](person_e_plan.md)
- [person_e_phase2_handoff.md](person_e_phase2_handoff.md)
