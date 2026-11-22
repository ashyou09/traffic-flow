"""Export the data the demo site needs into demo/assets/data.js.

Reads only files already in the repository: sensor locations, the DCRNN
adjacency, per-sensor hourly means, Phase 1 and Phase 2 metrics, model
configs, hyperparameter searches, GAT attention statistics, the 717468
case study and the signal-simulation summary.

    python demo/build_demo.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.phase2.common import load_graph_pickle  # noqa: E402  restricted loader

META = ROOT / "data/metadata"
OUT = ROOT / "demo/assets/data.js"
MODELS_60 = ["xgboost_ha", "gru_local", "gat", "dcrnn"]
CASE_MODELS = ["persistence", "xgboost_ha", "random_forest_32", "gat", "dcrnn", "gru_local"]
HORIZONS = ["5min", "15min", "30min", "60min"]


def r(x, n=3):
    return round(float(x), n)


def sensors_and_graph() -> dict:
    ids, _, adj = load_graph_pickle(ROOT / "data/raw/adj_mx.pkl")
    adj = np.asarray(adj)
    loc = pd.read_csv(ROOT / "data/raw/graph_sensor_locations.csv", dtype={"sensor_id": str})
    if loc.sensor_id.tolist() != ids:
        raise ValueError("sensor order in graph_sensor_locations.csv differs from adj_mx.pkl")
    ii, jj = np.nonzero(adj)
    edges = [[int(i), int(j), r(adj[i, j], 3)] for i, j in zip(ii, jj) if i != j]

    sm = pd.read_csv(META / "phase2/sensor_metrics.csv", dtype={"sensor_id": str})
    sm = sm[(sm.split == "test") & (sm.period == "all") & (sm.horizon == "60min")]
    mae60 = {m: sm[sm.model == m].set_index("sensor_id")["mae"].reindex(ids).round(2).tolist() for m in MODELS_60}
    dcrnn_sm = sm[sm.model == "dcrnn"].set_index("sensor_id").reindex(ids)
    deg = dcrnn_sm["graph_degree"].astype(int).tolist()
    region = dcrnn_sm["region"].astype(str).tolist()

    sens = pd.read_csv(META / "sensors.csv", dtype={"sensor_id": str}).set_index("sensor_id").reindex(ids)
    zero_pct = ((1.0 - sens["valid_fraction"]) * 100.0).round(1).tolist()
    outage_runs = sens["zero_outage_run_count"].astype(int).tolist()
    max_zero_run = sens["max_zero_run"].astype(int).tolist()

    att = pd.read_csv(META / "phase2/attention_stats.csv", dtype={"sensor_id": str})
    att = att[att.period == "all"].set_index("sensor_id").reindex(ids)
    hs = pd.read_csv(META / "hourly_mean_by_sensor.csv")
    self_loops = int((np.diag(adj) > 0).sum())
    return {
        "ids": ids,
        "lat": loc.latitude.round(5).tolist(),
        "lon": loc.longitude.round(5).tolist(),
        "region": region,
        "zeroPct": zero_pct,
        "outageRuns": outage_runs,
        "maxZeroRun": max_zero_run,
        "edges": edges,
        "selfLoops": self_loops,
        "geo": {
            "place": "Los Angeles County, CA",
            "dataset": "METR-LA (Caltrans PeMS)",
            "period": "Mar 1 – Jun 27, 2012",
            "latMin": r(loc.latitude.min(), 4),
            "latMax": r(loc.latitude.max(), 4),
            "lonMin": r(loc.longitude.min(), 4),
            "lonMax": r(loc.longitude.max(), 4),
            "totalDirectedEdges": len(edges) + self_loops,
        },
        "mae60": mae60,
        "deg": deg,
        "att": {c: att[c].round(3).tolist() for c in ["entropy", "mass_self", "mass_neighbours", "mass_downstream", "mass_upstream"]}
               | {"num_downstream": att.num_downstream.astype(int).tolist(), "num_upstream": att.num_upstream.astype(int).tolist()},
        "hs": [[r(hs.loc[h, i], 1) for h in range(24)] for i in ids],
        "hourly": pd.read_csv(META / "hourly_profile.csv").mean_speed.round(2).tolist(),
    }


def case_study() -> dict:
    cs = pd.read_csv(META / "phase2/case_study_717468.csv")
    out = {"sensor": "717468", "t": cs.origin_timestamp.str[11:16].tolist(), "date": cs.origin_timestamp.iloc[0][:10]}
    for h in HORIZONS:
        out["y" + h] = cs["target_" + h].round(1).tolist()
    for h in ["15min", "60min"]:
        for m in CASE_MODELS:
            out[f"{m}_{h}"] = cs[f"pred_{m}_{h}"].round(1).tolist()
    return out


def phase1_models() -> dict:
    c = json.loads((META / "person_c_results.json").read_text())["horizons"]
    d = json.loads((META / "person_d_results.json").read_text())
    top = lambda imp, k=12: [[f, r(v, 4)] for f, v in sorted(imp.items(), key=lambda x: -x[1])[:k]]
    return {
        "xgb_params": c["5min"]["fit"]["params"],
        "xgb_train_samples": c["5min"]["fit"]["train_samples"],
        "xgb_best_iter": {h: [c[h]["fit"]["best_iteration"], c[h]["fit_ha"]["best_iteration"]] for h in HORIZONS},
        "xgb_importance_60": {"xgb32": top(c["60min"]["feature_importance_gain"]), "xgb_ha": top(c["60min"]["feature_importance_gain_ha"])},
        "rf_params": {k: d["metadata"][k] for k in ["n_estimators", "max_depth", "max_samples", "random_state"]},
        "rf_ablation": {e: [r(d["experiments"][e][h]["test_metrics"]["mae"]) for h in HORIZONS] for e in "ABCD"},
    }


def phase2_models() -> dict:
    meta = pd.read_csv(META / "phase2/run_meta.csv")
    params = meta.groupby("model_id")["params"].first().astype(int).to_dict()
    spe = meta.groupby("model_id")["seconds_per_epoch"].mean().round(0).astype(int).to_dict()
    epochs = meta.groupby("model_id")["epochs_run"].apply(lambda s: sorted(set(s.astype(int)))).to_dict()
    stops = meta.groupby("model_id")["stop_reason"].apply(lambda s: sorted(set(s))).to_dict()
    search = {}
    for name in ["gru_local", "gat", "dcrnn"]:
        s = pd.read_csv(META / f"phase2/search_{name}.csv")
        search[name] = [{"candidate": int(row.candidate), "params": json.loads(row.params), "val_mae": r(row.val_mae_mean),
                         "epochs": int(row.epochs_run), "stop": row.stop_reason, "n_params": int(row.param_count)} for row in s.itertuples()]
    return {"params": params, "sec_per_epoch": spe, "epochs": epochs, "stops": stops, "search": search}


def daily_errors() -> dict:
    """Per-day test error sums at 60 min, for the in-browser block bootstrap."""
    d = pd.read_csv(META / "daily_forecast_errors.csv")
    d = d[(d.split == "test") & (d.horizon == "60min")]
    out = {"days": sorted(d.day.unique().tolist())}
    for m in ["persistence", "random_forest_32", "xgboost_32", "xgboost_ha"]:
        q = d[d.model == m].set_index("day").reindex(out["days"])
        out[m] = {"n": q.n.astype(int).tolist(), "abs": q.absolute_error_sum.round(1).tolist()}
    b = pd.read_csv(META / "paired_bootstrap.csv")
    b = b[b.horizon == "60min"]
    out["official"] = [[row.baseline, row.candidate, r(row.mae_difference), r(row.ci95_low), r(row.ci95_high)] for row in b.itertuples()]
    return out


def onset_and_hypotheses() -> dict:
    ev = pd.read_csv(META / "phase2/events.csv")
    ev60 = ev[ev.horizon == "60min"].set_index("model")
    order = ["dcrnn", "xgboost_ha", "gat", "gat_shuffled", "dcrnn_identity", "gat_identity", "gru_local", "random_forest_32", "xgboost_32", "persistence"]
    onset60 = [[m, r(ev60.loc[m, "recall_onset"] * 100.0, 1), r(ev60.loc[m, "precision_congestion"] * 100.0, 1)] for m in order if m in ev60.index]

    hyp = pd.read_csv(META / "phase2/hypotheses.csv").fillna("")
    hyps = []
    for hid in ["H1", "H2", "H3", "H4", "H5", "H0"]:
        sub = hyp[hyp.id == hid]
        if sub.empty:
            continue
        rows = []
        for row in sub.itertuples():
            diff = r(row.mae_difference, 3) if row.mae_difference != "" else None
            lo = r(row.ci95_low, 3) if row.ci95_low != "" else None
            hi = r(row.ci95_high, 3) if row.ci95_high != "" else None
            rows.append({
                "horizon": row.horizon,
                "comparison": row.comparison,
                "diff": diff,
                "lo": lo,
                "hi": hi,
                "verdict": row.verdict,
                "note": row.note,
            })
        hyps.append({
            "id": hid,
            "statement": str(sub.iloc[0].statement),
            "verdict": str(sub.iloc[0].overall_verdict),
            "rows": rows,
        })
    return {"onset60": onset60, "hypotheses": hyps}


def main() -> None:
    data = (
        sensors_and_graph()
        | {"case": case_study(), "p1": phase1_models(), "p2": phase2_models(), "daily": daily_errors()}
        | onset_and_hypotheses()
    )
    OUT.write_text("/* generated by demo/build_demo.py from data/metadata, do not edit */\nwindow.DATA = "
                   + json.dumps(data, separators=(",", ":")) + ";\n")
    print("wrote", OUT, f"({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
