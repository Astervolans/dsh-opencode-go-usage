// dsh-opencode-go-usage — browser half.
//
// Hand-authored client bundle in the DSH module-loader factory format:
// `window.__ModuleLoader__.load({ id, factory })`. The factory receives the
// module-table `require`, so only shell-externalized modules may be imported
// (react / react/jsx-runtime are in the static table). It registers a widget
// into the sidebar's `sidebar.footer.action` list slot and polls the
// same-origin proxy route owned by the host half — the GO API key never
// enters the browser. UI strings are bilingual via the DSH locale service
// (dictionaries registered under the `dsh-opencode-go-usage` namespace).
window.__ModuleLoader__.load({
	id: "@astervolans/dsh-opencode-go-usage",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");

		// ── styles (injected once, same pattern as built-in client plugins) ──
		const CSS_ID = "dsh-opencode-go-usage/widget.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"" + CSS_ID + "\"]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-opencode-go-usage";
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = [
				".ocg-widget{box-sizing:border-box;width:100%;min-width:0;padding:6px 6px 4px;display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}",
				".ocg-widget:hover{background:var(--dsw-alias-interactive-bg-hover)}",
				".ocg-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;line-height:18px}",
				".ocg-refresh{cursor:pointer;border:none;background:none;padding:0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}",
				".ocg-refresh:hover{color:var(--dsw-alias-label-primary)}",
				".ocg-row{display:flex;flex-direction:column;gap:3px;min-width:0}",
				".ocg-row-label{display:flex;justify-content:space-between;gap:8px;font-size:11px;line-height:15px;color:var(--dsw-alias-label-secondary)}",
				".ocg-row-label b{font-weight:500;color:var(--dsw-alias-label-primary)}",
				".ocg-meta{display:flex;align-items:center;gap:6px;min-width:0}",
				// The two stacked bars share one flex column. `min-width:0` + `flex:1`
				// belongs on the COLUMN (it is the flex item of .ocg-meta); the bars
				// inside it must keep their own fixed heights, hence flex:none — with
				// `flex:1` on a column axis they would flex to zero height.
				".ocg-meta .ocg-bars{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}",
				".ocg-meta>span{font-size:10px;line-height:14px;color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:none}",
				".ocg-track{box-sizing:border-box;flex:none;height:5px;border-radius:3px;background:var(--dsw-alias-border-l2);overflow:hidden}",
				".ocg-fill{height:100%;border-radius:3px;transition:width .4s ease}",
				// Time bar: two SIDE-BY-SIDE segments, never overlapping. The gray
				// segment on the left is the time already elapsed (it grows
				// rightward) and the blue segment on the right is the time left
				// (it shrinks leftward). Sizing both halves keeps the split exactly
				// at the elapsed fraction.
				//
				// Geometry is deliberately IDENTICAL to the quota bar above
				// (.ocg-track / .ocg-fill: height 5px, radius 3px) so the two
				// stacked bars match in shape and differ only in color and
				// direction. Both segments round ALL four corners — their own
				// outer end AND the junction where they meet — mirroring the
				// reference fill, whose rounded caps stay visible on both ends.
				// The gray also reuses the quota bar's track token, so both
				// grays read as one shade.
				".ocg-timetrack{box-sizing:border-box;flex:none;display:flex;width:100%;height:5px;border-radius:3px;overflow:hidden;background:var(--dsw-alias-border-l2)}",
				".ocg-timeelapsed{height:100%;flex:none;background:var(--dsw-alias-border-l2);border-radius:3px;transition:width .4s ease}",
				".ocg-timeremain{height:100%;flex:1 1 auto;min-width:0;background:var(--dsw-static-deepseek-450, #5686fe);border-radius:3px;transition:width .4s ease}",
				".ocg-err{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
				".ocg-rail{box-sizing:border-box;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:10px;font-weight:700;color:var(--dsw-alias-label-primary);cursor:default}",
				".ocg-rail:hover{background:var(--dsw-alias-interactive-bg-hover)}",
				".ocg-update{display:inline-block;padding:1px 6px;border-radius:8px;font-size:10px;line-height:16px;font-weight:600;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);text-decoration:none;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px}"
			].join("");
			document.head.appendChild(tag);
		}

		// ── locale dictionaries ──
		const NS = "dsh-opencode-go-usage";
		const zh = {
			"window.rolling": "滚动窗口 (5h)",
			"window.weekly": "周窗口",
			"window.monthly": "月窗口",
			"window.rolling.hint": "5h",
			"time.soon": "即将重置",
			"time.minutes": "{n}分",
			"time.hours": "{n}小时{m}分",
			"time.days": "{n}天{m}小时",
			"time.elapsed.title": "本窗口时间进度:已流逝 {pct}%,剩余 {rest}%",
			"refresh": "刷新",
			"loading": "加载中…",
			"rail.title": "OpenCode GO 月用量 {pct}%",
			"rail.plain": "OpenCode GO",
			"update.available": "新版本 v{v}",
			"update.title": "点击查看升级说明"
		};
		const en = {
			"window.rolling": "Rolling (5h)",
			"window.weekly": "Weekly",
			"window.monthly": "Monthly",
			"window.rolling.hint": "5h",
			"time.soon": "resets soon",
			"time.minutes": "{n}m",
			"time.hours": "{n}h{m}m",
			"time.days": "{n}d{m}h",
			"time.elapsed.title": "Window time: {pct}% elapsed, {rest}% left",
			"refresh": "Refresh",
			"loading": "Loading…",
			"rail.title": "OpenCode GO monthly {pct}%",
			"rail.plain": "OpenCode GO",
			"update.available": "v{v} available",
			"update.title": "Click for upgrade instructions"
		};

		// ── data helpers ──
		/**
		 * The three plan windows. `windowMs` is the window LENGTH and is what the
		 * time-remaining bar is computed from; every entry must have one.
		 *
		 * - rolling: the 5 h window documented by the GO plan (matches the
		 *   `window.rolling.hint` label and observed `resetsAt` spacing).
		 * - weekly: anchored to Monday 00:00 UTC — observed `resetsAt` values are
		 *   exactly 7 d apart (e.g. 2026-09-21T00:00:00Z).
		 * - monthly: ~30 d. The monthly window is anchored to the subscription
		 *   day-of-month, so its real length alternates 30/31 d (or 28/29 d in
		 *   February). 30 d is therefore an approximation: the derived fraction is
		 *   clamped to [0,1], so the bar stays correct at the window boundaries and
		 *   is at most ~3 % off mid-window.
		 */
		const WINDOW_MS = { rolling: 5 * 3600e3, weekly: 7 * 86400e3, monthly: 30 * 86400e3 };
		const WINDOWS = [
			{ key: "rolling", labelKey: "window.rolling", hintKey: "window.rolling.hint", windowMs: WINDOW_MS.rolling },
			{ key: "weekly", labelKey: "window.weekly", hintKey: null, windowMs: WINDOW_MS.weekly },
			{ key: "monthly", labelKey: "window.monthly", hintKey: null, windowMs: WINDOW_MS.monthly }
		];

		/**
		 * Fraction of the window ALREADY elapsed, derived from its reset time:
		 * window start = resetsAt - windowMs. 0 = window just opened (empty bar),
		 * 1 = about to reset (full bar), so the bar grows left-to-right as the
		 * window is consumed. Correlate against the quota bar above it to see
		 * whether quota is burning faster or slower than the clock.
		 * @returns {number|null} null when the window length or reset time is unknown.
		 */
		function timeElapsedFraction(resetsAt, windowMs) {
			if (!resetsAt || !windowMs) return null;
			const reset = new Date(resetsAt).getTime();
			if (!Number.isFinite(reset)) return null;
			const elapsed = (windowMs - (reset - Date.now())) / windowMs;
			return Math.max(0, Math.min(1, elapsed));
		}

		/** Short human relative time until `iso`, localized. */
		function timeUntil(iso, t) {
			const target = new Date(iso).getTime();
			if (!Number.isFinite(target)) return "";
			const diff = target - Date.now();
			if (diff <= 0) return t("time.soon");
			const mins = Math.floor(diff / 60000);
			if (mins < 60) return t("time.minutes", { n: mins });
			const hours = Math.floor(mins / 60);
			if (hours < 24) return t("time.hours", { n: hours, m: mins % 60 });
			return t("time.days", { n: Math.floor(hours / 24), m: hours % 24 });
		}

		/** Fill color by usage percent — themed alias tokens (light/dark safe). */
		function fillColor(percent) {
			if (percent >= 90) return "var(--dsw-alias-state-error-primary)";
			if (percent >= 70) return "var(--dsw-alias-state-warn-primary)";
			return "var(--dsw-alias-state-success-primary)";
		}

		// ── widget component ──
		/**
		 * @param {{ wide?: boolean, t?: Function }} props - owner share from the
		 * sidebar (`sidebar.footer.action` is rendered with `{ wide }`) plus the
		 * locale translate seat declared by this registration.
		 */
		function Widget(props) {
			const t = props.t || ((key) => key);
			const [data, setData] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [stamp, setStamp] = react.useState(0);

			react.useEffect(() => {
				let alive = true;
				const load = async () => {
					try {
						const res = await fetch("/opencode-go/usage", { cache: "no-store" });
						const json = await res.json().catch(() => null);
						if (!alive) return;
						if (!res.ok || json === null || json.error) {
							setError(String((json && json.error) || "HTTP " + res.status));
							setData(null);
						} else {
							setData(json);
							setError(null);
						}
					} catch (e) {
						if (!alive) return;
						setError(String((e && e.message) || e));
						setData(null);
					}
				};
				load();
				const timer = window.setInterval(load, 60000);
				return () => { alive = false; window.clearInterval(timer); };
			}, [stamp]);

			// Slow tick purely for the time-remaining bars: they are derived from
			// `Date.now()`, so without a re-render they would only move once per
			// 60 s poll. 30 s keeps them visibly progressing without busy work.
			const [, setTick] = react.useState(0);
			react.useEffect(() => {
				const timer = window.setInterval(() => setTick((n) => n + 1), 30000);
				return () => window.clearInterval(timer);
			}, []);

			const monthly = data && data.usage ? data.usage.monthly : null;
			const pct = monthly && typeof monthly.percent === "number" ? monthly.percent : null;

			// Collapsed rail: a compact badge with the monthly percentage.
			if (!props.wide) {
				return react_jsx_runtime.jsx("div", {
					className: "ocg-rail",
					title: error ? ("OpenCode GO: " + error) : (pct === null ? t("rail.plain") : t("rail.title", { pct: pct })),
					children: pct === null ? "GO" : pct + "%"
				});
			}

			// Expanded footer widget: three window progress bars.
			const rows = [];
			for (const w of WINDOWS) {
				const win = data && data.usage ? data.usage[w.key] : null;
				if (!win || typeof win.percent !== "number") continue;
				// Time elapsed in this window, for the blue bar under the quota bar.
				const elapsed = timeElapsedFraction(win.resetsAt, w.windowMs);
				rows.push(react_jsx_runtime.jsx("div", {
					className: "ocg-row",
					children: [
						// Name + percentage on one line (percentage right-aligned).
						react_jsx_runtime.jsx("div", {
							className: "ocg-row-label",
							children: [
								react_jsx_runtime.jsx("b", { children: t(w.labelKey) }),
								react_jsx_runtime.jsx("b", { children: win.percent + "%" })
							]
						}),
						// Two stacked bars sharing one flex column plus the countdown
						// on the right: the upper bar is quota used, the lower bar is
						// the window clock — GRAY on the left is time already elapsed
						// (it grows rightward) and BLUE on the right is time still
						// left (it shrinks), so quota burn can be compared against the
						// clock at a glance. Status replaces the countdown when not ok.
						react_jsx_runtime.jsx("div", {
							className: "ocg-meta",
							children: [
								react_jsx_runtime.jsx("div", {
									className: "ocg-bars",
									children: [
										react_jsx_runtime.jsx("div", {
											className: "ocg-track",
											children: react_jsx_runtime.jsx("div", {
												className: "ocg-fill",
												style: {
													width: Math.max(0, Math.min(100, win.percent)) + "%",
													background: fillColor(win.percent)
												}
											})
										}),
										elapsed === null ? null : react_jsx_runtime.jsx("div", {
											className: "ocg-timetrack",
											title: t("time.elapsed.title", { pct: Math.round(elapsed * 100), rest: Math.round((1 - elapsed) * 100) }),
											children: [
												// Left: elapsed (gray, grows rightward).
												react_jsx_runtime.jsx("div", {
													className: "ocg-timeelapsed",
													style: { width: (elapsed * 100) + "%" }
												}),
												// Right: remaining (blue, shrinks leftward). Both
												// segments are flex siblings, so they sit next to
												// each other instead of overlapping.
												react_jsx_runtime.jsx("div", {
													className: "ocg-timeremain",
													style: { width: ((1 - elapsed) * 100) + "%" }
												})
											]
										})
									]
								}),
								react_jsx_runtime.jsx("span", {
									children: win.status === "ok"
										? (win.resetsAt ? timeUntil(win.resetsAt, t) : (w.hintKey ? t(w.hintKey) : ""))
										: win.status
								})
							]
						})
					]
				}, w.key));
			}

			return react_jsx_runtime.jsx("div", {
				className: "ocg-widget",
				children: [
					react_jsx_runtime.jsx("div", {
						className: "ocg-head",
						children: [
							react_jsx_runtime.jsx("span", { children: "OpenCode GO" }),
							(data && data.update && data.update.available && data.update.latest
								? react_jsx_runtime.jsx("a", {
									className: "ocg-update",
									href: "https://www.npmjs.com/package/@astervolans/dsh-opencode-go-usage",
									target: "_blank",
									rel: "noreferrer",
									title: t("update.title"),
									children: t("update.available", { v: data.update.latest })
								})
								: null),
							react_jsx_runtime.jsx("button", {
								className: "ocg-refresh",
								onClick: () => setStamp(stamp + 1),
								children: t("refresh")
							})
						]
					}),
					error ? react_jsx_runtime.jsx("div", { className: "ocg-err", children: error }) : null,
					!error && data === null ? react_jsx_runtime.jsx("div", { className: "ocg-err", children: t("loading") }) : null,
					rows.length > 0 ? react_jsx_runtime.jsx(react.Fragment, { children: rows }) : null
				]
			});
		}

		// ── cordis plugin entry ──
		const inject = ["slots", "locale"];

		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-opencode-go-usage: dictionaries");
			const registerWidget = () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "@astervolans/dsh-opencode-go-usage",
				order: 0,
				label: "OpenCode GO",
				locale: NS
			}, Widget);
			if (typeof ctx.slots.inject === "function") {
				ctx.slots.inject("sidebar.footer.action", registerWidget);
			} else {
				ctx.effect(registerWidget, "dsh-opencode-go-usage: widget registration");
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
