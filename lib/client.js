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
	id: "dsh-opencode-go-usage",
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
				".ocg-widget{box-sizing:border-box;width:100%;min-width:0;padding:8px 6px;display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}",
				".ocg-widget:hover{background:var(--dsw-alias-interactive-bg-hover)}",
				".ocg-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;line-height:18px}",
				".ocg-refresh{cursor:pointer;border:none;background:none;padding:0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}",
				".ocg-refresh:hover{color:var(--dsw-alias-label-primary)}",
				".ocg-row{display:flex;flex-direction:column;gap:3px;min-width:0}",
				".ocg-row-label{display:flex;justify-content:space-between;gap:8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}",
				".ocg-row-label b{font-weight:500;color:var(--dsw-alias-label-primary)}",
				".ocg-track{box-sizing:border-box;height:5px;border-radius:3px;background:var(--dsw-alias-border-l2);overflow:hidden}",
				".ocg-fill{height:100%;border-radius:3px;transition:width .4s ease}",
				".ocg-err{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
				".ocg-rail{box-sizing:border-box;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:10px;font-weight:700;color:var(--dsw-alias-label-primary);cursor:default}",
				".ocg-rail:hover{background:var(--dsw-alias-interactive-bg-hover)}"
			].join("");
			document.head.appendChild(tag);
		}

		// ── locale dictionaries ──
		const NS = "dsh-opencode-go-usage";
		const zh = {
			"window.rolling": "滚动窗口",
			"window.weekly": "周窗口",
			"window.monthly": "月窗口",
			"window.rolling.hint": "5 小时",
			"status.ok": "正常",
			"time.soon": "即将重置",
			"time.minutes": "{n} 分后重置",
			"time.hours": "{n} 小时 {m} 分后",
			"time.days": "{n} 天 {m} 小时后",
			"refresh": "刷新",
			"loading": "加载中…",
			"rail.title": "OpenCode GO 月用量 {pct}%",
			"rail.plain": "OpenCode GO"
		};
		const en = {
			"window.rolling": "Rolling (5h)",
			"window.weekly": "Weekly",
			"window.monthly": "Monthly",
			"window.rolling.hint": "5 hours",
			"status.ok": "OK",
			"time.soon": "resets soon",
			"time.minutes": "in {n} min",
			"time.hours": "in {n}h {m}m",
			"time.days": "in {n}d {m}h",
			"refresh": "Refresh",
			"loading": "Loading…",
			"rail.title": "OpenCode GO monthly {pct}%",
			"rail.plain": "OpenCode GO"
		};

		// ── data helpers ──
		const WINDOWS = [
			{ key: "rolling", labelKey: "window.rolling", hintKey: "window.rolling.hint" },
			{ key: "weekly", labelKey: "window.weekly", hintKey: null },
			{ key: "monthly", labelKey: "window.monthly", hintKey: null }
		];

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

		/** Fill color by usage percent. */
		function fillColor(percent) {
			if (percent >= 90) return "#ff3b30";
			if (percent >= 70) return "#ff9500";
			return "#34c759";
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
				rows.push(react_jsx_runtime.jsx("div", {
					className: "ocg-row",
					children: [
						react_jsx_runtime.jsx("div", {
							className: "ocg-row-label",
							children: [
								react_jsx_runtime.jsx("b", { children: t(w.labelKey) }),
								react_jsx_runtime.jsx("span", { children: (win.resetsAt ? timeUntil(win.resetsAt, t) : (w.hintKey ? t(w.hintKey) : "")) })
							]
						}),
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
						react_jsx_runtime.jsx("div", {
							className: "ocg-row-label",
							children: [
								react_jsx_runtime.jsx("span", { children: win.status === "ok" ? t("status.ok") : win.status }),
								react_jsx_runtime.jsx("span", { children: win.percent + "%" })
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
			ctx.effect(() => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-opencode-go-usage",
				order: 0,
				label: "OpenCode GO",
				locale: NS
			}, Widget), "dsh-opencode-go-usage: widget registration");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
