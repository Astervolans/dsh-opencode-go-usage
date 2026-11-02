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
/**
 * This bundle's npm name is also the module-loader row id and the exact key of
 * the `plugins.bundle.config` cell below (the Plugins panel addresses a
 * bundle's configuration page by package name). Keep it equal to
 * `package.json#name`.
 *
 * It is declared INSIDE the factory on purpose: the shell evaluates every
 * client bundle as a classic script in one shared global lexical scope, so a
 * top-level `const PACKAGE_NAME` collides with any other plugin declaring the
 * same name (for example `@astervolans/dsh-literature-search`), failing the
 * whole web boot.
 */
window.__ModuleLoader__.load({
	id: "@astervolans/dsh-opencode-go-usage",
	factory: (require) => {
		// Kept factory-local (see the comment above): no top-level declaration
		// in this file may enter the shell's shared global lexical scope.
		const PACKAGE_NAME = "@astervolans/dsh-opencode-go-usage";
		const CONFIG_KEY = PACKAGE_NAME;
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
				// Left cluster of the header: brand, active account name, and the
				// built-in fallback badge. It is the flexible item, so a long account
				// name ellipsizes instead of pushing Refresh out of the widget.
				".ocg-headleft{display:flex;align-items:center;gap:5px;flex:1;min-width:0;overflow:hidden}",
				".ocg-name{white-space:nowrap;flex:none}",
				".ocg-account{color:var(--dsw-alias-label-secondary);font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
				".ocg-fallback{flex:none;padding:0 5px;border-radius:8px;font-size:10px;line-height:16px;font-weight:600;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover);white-space:nowrap;cursor:default}",
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
			"rail.error": "OpenCode GO: {error}",
			"rail.account": "OpenCode GO · {name}",
			"rail.title.account": "OpenCode GO · {name} 月用量 {pct}%",
			"widget.brand": "OpenCode GO",
			"widget.account.title": "当前账号:{name}",
			"widget.fallback": "内置",
			"widget.fallback.title": "实际来源:{source};请求来源:{requested};回退原因:{reason}{message}",
			"source.opencode-go": "dsh-opencode-go 当前账号",
			"source.builtin": "DSH 内置提供商",
			"reason.not-installed": "未安装 dsh-opencode-go",
			"reason.entry-disabled": "dsh-opencode-go 已禁用",
			"reason.service-unavailable": "宿主服务不可用",
			"reason.read-failed": "读取额度失败",
			"reason.invalid-response": "额度数据不合法",
			"reason.unknown": "未知原因",
			"update.available": "新版本 v{v}",
			"update.title": "点击查看升级说明",

			// settings page (Plugins panel)
			"cfg.summary": "OpenCode GO 额度来源:优先 dsh-opencode-go 当前账号(失败时自动回退到 DSH 内置提供商),或固定使用内置提供商。",
			"cfg.title": "额度来源 (quotaSource)",
			"cfg.lead": "侧边栏 widget 与 /opencode-go 命令读取额度时使用的来源。保存后立即生效,无需重启。",
			"cfg.loading": "正在加载额度来源设置…",
			"cfg.save": "保存",
			"cfg.saving": "保存中…",
			"cfg.reload": "重新加载",
			"cfg.reloading": "加载中…",
			"cfg.reloaded": "已重新加载。",
			"cfg.retry": "重试",
			"cfg.saved": "已保存,额度来源已更新。",
			"cfg.noChanges": "没有需要保存的更改。",
			"cfg.unsaved": "未保存",
			"cfg.conflict": "保存冲突:设置已被其他会话修改,请点击「重新加载」后再保存。",
			"cfg.saveFailed": "保存失败:{error}",
			"cfg.loadFailed": "加载设置失败:{error}",
			"cfg.unsupported": "宿主未提供设置描述符(503)。请确认插件以 profile 条目安装,且 schemastery 版本 ≥ 3.18.4。",
			"cfg.revision": "revision {n}",
			"cfg.option.opencode-go": "优先 dsh-opencode-go(当前账号)",
			"cfg.option.opencode-go.desc": "读取 dsh-opencode-go 插件当前生效账号的额度;未安装、被禁用或出错时自动回退到 DSH 内置提供商,并在 widget 上标注。",
			"cfg.option.builtin": "DSH 内置提供商",
			"cfg.option.builtin.desc": "始终使用 baseUrl + /v1/usage(凭据 apiKeyEnv),与 1.5.0 行为一致。",
			"cfg.status.title": "当前状态",
			"cfg.status.mode": "请求来源",
			"cfg.status.effective": "生效来源",
			"cfg.status.package": "dsh-opencode-go",
			"cfg.status.entry": "loader 条目",
			"cfg.status.enabled": "启用状态",
			"cfg.status.service": "宿主服务 (opencodeGoUsage)",
			"cfg.status.compatible": "兼容性",
			"cfg.status.account": "当前账号",
			"cfg.status.fallback": "回退",
			"cfg.status.detected": "已检测到",
			"cfg.status.notDetected": "未检测到",
			"cfg.status.found": "已找到",
			"cfg.status.notFound": "未找到",
			"cfg.status.on": "已启用",
			"cfg.status.off": "已禁用",
			"cfg.status.available": "可用",
			"cfg.status.unavailable": "不可用",
			"cfg.status.compatibleYes": "兼容",
			"cfg.status.compatibleNo": "不兼容",
			"cfg.status.none": "无",
			"cfg.status.unknown": "—",
			"cfg.status.defaultAccount": "默认账号",
			"cfg.status.hint.missing": "未检测到 dsh-opencode-go:额度将使用 DSH 内置提供商。"
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
			"rail.error": "OpenCode GO: {error}",
			"rail.account": "OpenCode GO · {name}",
			"rail.title.account": "OpenCode GO · {name} monthly {pct}%",
			"widget.brand": "OpenCode GO",
			"widget.account.title": "Active account: {name}",
			"widget.fallback": "Built-in",
			"widget.fallback.title": "Effective source: {source}; requested: {requested}; fallback reason: {reason}{message}",
			"source.opencode-go": "dsh-opencode-go current account",
			"source.builtin": "DSH built-in provider",
			"reason.not-installed": "dsh-opencode-go not installed",
			"reason.entry-disabled": "dsh-opencode-go disabled",
			"reason.service-unavailable": "host service unavailable",
			"reason.read-failed": "quota read failed",
			"reason.invalid-response": "invalid quota response",
			"reason.unknown": "unknown reason",
			"update.available": "v{v} available",
			"update.title": "Click for upgrade instructions",

			// settings page (Plugins panel)
			"cfg.summary": "OpenCode GO quota source: prefer the dsh-opencode-go current account (with automatic fallback to the DSH built-in provider), or always use the built-in provider.",
			"cfg.title": "Quota source (quotaSource)",
			"cfg.lead": "Source used by the sidebar widget and the /opencode-go command. Takes effect immediately on save; no restart needed.",
			"cfg.loading": "Loading quota source settings…",
			"cfg.save": "Save",
			"cfg.saving": "Saving…",
			"cfg.reload": "Reload",
			"cfg.reloading": "Loading…",
			"cfg.reloaded": "Reloaded.",
			"cfg.retry": "Retry",
			"cfg.saved": "Saved — the quota source has been updated.",
			"cfg.noChanges": "Nothing to save.",
			"cfg.unsaved": "unsaved",
			"cfg.conflict": "Save conflict: the settings were changed by another session. Click Reload, then save again.",
			"cfg.saveFailed": "Save failed: {error}",
			"cfg.loadFailed": "Failed to load settings: {error}",
			"cfg.unsupported": "The host exposes no settings descriptor (503). Make sure the plugin is installed as a profile entry and schemastery is ≥ 3.18.4.",
			"cfg.revision": "revision {n}",
			"cfg.option.opencode-go": "Prefer dsh-opencode-go (current account)",
			"cfg.option.opencode-go.desc": "Read the quota of the account dsh-opencode-go currently uses; when it is missing, disabled, or fails, fall back to the DSH built-in provider and label it in the widget.",
			"cfg.option.builtin": "DSH built-in provider",
			"cfg.option.builtin.desc": "Always use baseUrl + /v1/usage (credential apiKeyEnv) — the 1.5.0 behaviour.",
			"cfg.status.title": "Current status",
			"cfg.status.mode": "Requested source",
			"cfg.status.effective": "Effective source",
			"cfg.status.package": "dsh-opencode-go",
			"cfg.status.entry": "Loader entry",
			"cfg.status.enabled": "Enabled",
			"cfg.status.service": "Host service (opencodeGoUsage)",
			"cfg.status.compatible": "Compatibility",
			"cfg.status.account": "Active account",
			"cfg.status.fallback": "Fallback",
			"cfg.status.detected": "detected",
			"cfg.status.notDetected": "not detected",
			"cfg.status.found": "found",
			"cfg.status.notFound": "not found",
			"cfg.status.on": "enabled",
			"cfg.status.off": "disabled",
			"cfg.status.available": "available",
			"cfg.status.unavailable": "unavailable",
			"cfg.status.compatibleYes": "compatible",
			"cfg.status.compatibleNo": "incompatible",
			"cfg.status.none": "none",
			"cfg.status.unknown": "—",
			"cfg.status.defaultAccount": "default account",
			"cfg.status.hint.missing": "dsh-opencode-go was not detected: quota will come from the DSH built-in provider."
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

		// ── display helpers (defensive: any field of a newer payload may be
		// absent when an older host serves the bundle, and a thrown render would
		// take down the widget or the whole Plugins panel) ──
		function asText(value) {
			if (typeof value === "string") return value;
			if (value === null || value === undefined) return "";
			return String(value);
		}

		/** Localized label of an effective/requested source. */
		function sourceLabel(t, source) {
			return source === "builtin" ? t("source.builtin") : t("source.opencode-go");
		}

		/** Localized label of a fallback reason; unknown reasons fall through. */
		function reasonLabel(t, reason) {
			const key = "reason." + (typeof reason === "string" && reason !== "" ? reason : "unknown");
			const label = t(key);
			return label === key ? t("reason.unknown") : label;
		}

		/**
		 * Tooltip of the "内置 / built-in" badge: effective source, requested
		 * source, fallback reason, and the host's message when it sent one.
		 */
		function fallbackTitle(t, fallback, source) {
			const requested = fallback && (fallback.from === "builtin" || fallback.from === "opencode-go") ? fallback.from : source;
			const reason = reasonLabel(t, fallback && fallback.reason);
			const raw = asText(fallback && fallback.message);
			return t("widget.fallback.title", {
				source: sourceLabel(t, source),
				requested: requested === "builtin" || requested === "opencode-go" ? sourceLabel(t, requested) : sourceLabel(t, source),
				reason: reason,
				message: raw === "" ? "" : " · " + raw
			});
		}

		/**
		 * Collapsed-rail tooltip. Mentions the active account and the source, so
		 * the rail still says whose quota it is showing while collapsed.
		 */
		function railTitle(t, error, pct, accountName, source, fallback) {
			if (error) return t("rail.error", { error: error });
			let title;
			if (pct === null) title = accountName === "" ? t("rail.plain") : t("rail.account", { name: accountName });
			else title = accountName === "" ? t("rail.title", { pct: pct }) : t("rail.title.account", { pct: pct, name: accountName });
			if (source === "opencode-go" || source === "builtin") title += " · " + sourceLabel(t, source);
			if (fallback) title += " · " + reasonLabel(t, fallback.reason);
			return title;
		}

		/**
		 * Translate from the dictionaries above when the slot owner does not hand
		 * a `t` seat to a component (the settings page is also rendered by test
		 * harnesses that call it directly). Mirrors the `{name}` placeholder
		 * syntax the locale service uses.
		 */
		function detectLang() {
			try {
				const lang = (typeof document !== "undefined" && document.documentElement && document.documentElement.lang)
					|| (typeof navigator !== "undefined" && navigator.language)
					|| "";
				return String(lang).toLowerCase();
			} catch (_error) {
				return "";
			}
		}

		function fallbackT(key, params) {
			const table = detectLang().indexOf("zh") === 0 ? zh : en;
			let raw = table[key] !== undefined ? table[key] : zh[key] !== undefined ? zh[key] : key;
			if (params === null || params === undefined) return raw;
			return String(raw).replace(/\{(\w+)\}/g, (match, name) => (params[name] === null || params[name] === undefined ? "" : String(params[name])));
		}

		/** Resolve the page's translator: slot-provided seat first, dictionary last. */
		function translateFor(props) {
			return props && typeof props.t === "function" ? props.t : fallbackT;
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

			// New in 1.6.0 — every one of these is optional on an older host
			// payload, so each read is guarded and absent fields simply render
			// nothing (the widget looks exactly like 1.5.0 then).
			const accountName = data && data.account && typeof data.account.name === "string" ? data.account.name.trim() : "";
			const source = data && typeof data.source === "string" ? data.source : null;
			const fallback = data && data.fallback && typeof data.fallback === "object" ? data.fallback : null;

			// Collapsed rail: a compact badge with the monthly percentage.
			if (!props.wide) {
				return react_jsx_runtime.jsx("div", {
					className: "ocg-rail",
					title: railTitle(t, error, pct, accountName, source, fallback),
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
							react_jsx_runtime.jsxs("div", {
								className: "ocg-headleft",
								children: [
									react_jsx_runtime.jsx("span", { className: "ocg-name", children: t("widget.brand") }),
									accountName === "" ? null : react_jsx_runtime.jsx("span", {
										className: "ocg-account",
										title: t("widget.account.title", { name: accountName }),
										children: "· " + accountName
									}),
									fallback === null ? null : react_jsx_runtime.jsx("span", {
										className: "ocg-fallback",
										title: fallbackTitle(t, fallback, source),
										children: t("widget.fallback")
									})
								]
							}),
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

		// ── settings page (Plugins panel → this bundle) ─────────────────────
		//
		// `plugins.bundle.config` is a KEYED slot: @deepseek-ai/dsh-client-ui-plugin-manager
		// asks a bundle for its configuration page by PACKAGE NAME (not by row
		// id) and renders it above the bundle's rows. The slot component below
		// branches on `props.view` before any hook: `summary` is a plain string
		// and `page` (or a missing view) mounts {@link SettingsPage}. The page
		// reads/writes this plugin's settings namespace through its own routes;
		// a thrown render would take the whole Plugins panel down, so every
		// payload field is read defensively.
		const SETTINGS_PATH = "/opencode-go/settings";
		const SOURCES = ["opencode-go", "builtin"];

		/** The two sources are a closed set; anything else means "prefer opencode-go". */
		function normalizeSource(raw) {
			return raw === "builtin" ? "builtin" : "opencode-go";
		}

		/**
		 * Call one of this plugin's routes.
		 * @returns {Promise<{ status: number, payload: any }>} payload is null when
		 * the body was not JSON (an HTML error page, for instance).
		 */
		async function callApi(method, path, body) {
			const init = { method: method, cache: "no-store", credentials: "same-origin" };
			if (body !== undefined) {
				init.headers = { "content-type": "application/json" };
				init.body = JSON.stringify(body);
			}
			const res = await fetch(path, init);
			let payload = null;
			try {
				payload = await res.json();
			} catch (_error) {
				payload = null;
			}
			return { status: res.status, payload: payload };
		}

		// Inline styles on the DSH design tokens. The reference settings card
		// (dsh-literature-search) uses the same treatment; keeping it inline
		// means the page needs no extra CSS rule to be picked up.
		const PS = {
			wrap: { display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 8px" },
			card: {
				background: "var(--dsw-alias-bg-layer-3, #16181d)",
				border: "1px solid var(--dsw-alias-border-l2, #2a2d34)",
				borderRadius: 10,
				padding: "14px 16px",
				display: "flex",
				flexDirection: "column",
				gap: 10
			},
			title: { fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary, #e8e8e8)" },
			hint: { margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--dsw-alias-label-tertiary, #8a8f98)" },
			option: {
				display: "flex",
				gap: 10,
				alignItems: "flex-start",
				padding: "10px 12px",
				borderRadius: 8,
				border: "1px solid var(--dsw-alias-border-l2, #2a2d34)",
				background: "transparent",
				cursor: "pointer"
			},
			optionActive: {
				borderColor: "var(--dsw-static-deepseek-450, #5686fe)",
				background: "var(--dsw-alias-interactive-bg-hover)"
			},
			radio: { margin: "2px 0 0", flex: "none", accentColor: "var(--dsw-static-deepseek-450, #5686fe)" },
			optionBody: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
			optionTitle: { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-primary, #e8e8e8)" },
			optionDesc: { fontSize: 12, lineHeight: 1.55, color: "var(--dsw-alias-label-tertiary, #8a8f98)" },
			row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
			statusRow: { display: "flex", gap: 10, alignItems: "baseline", minWidth: 0, fontSize: 12, lineHeight: 1.5 },
			statusLabel: { flex: "0 0 150px", color: "var(--dsw-alias-label-tertiary, #8a8f98)" },
			statusValue: { flex: 1, minWidth: 0, color: "var(--dsw-alias-label-primary, #e8e8e8)", overflowWrap: "anywhere" },
			ok: { margin: 0, fontSize: 12, color: "var(--dsw-alias-state-success-primary, #5dbb76)" },
			warn: { margin: 0, fontSize: 12, color: "var(--dsw-alias-state-warn-primary, #d6a64b)" },
			err: { margin: 0, fontSize: 12, color: "var(--dsw-alias-state-error-primary, #e5484d)" },
			info: { margin: 0, fontSize: 12, color: "var(--dsw-alias-label-tertiary, #8a8f98)" },
			button: {
				font: "inherit",
				cursor: "pointer",
				background: "transparent",
				color: "var(--dsw-alias-label-secondary, #a8adb8)",
				border: "1px solid var(--dsw-alias-border-l2, #2a2d34)",
				borderRadius: 8,
				padding: "6px 14px",
				fontSize: 12
			},
			buttonPrimary: {
				font: "inherit",
				cursor: "pointer",
				background: "var(--dsw-alias-label-primary, #0f1115)",
				color: "var(--dsw-alias-bg-layer-3, #ffffff)",
				border: "1px solid transparent",
				borderRadius: 8,
				padding: "7px 16px",
				fontSize: 12,
				fontWeight: 500
			},
			buttonDisabled: { opacity: 0.4, cursor: "not-allowed" }
		};

		/** One label/value line of the detection status panel. */
		function StatusRow(props) {
			return react_jsx_runtime.jsx("div", {
				style: PS.statusRow,
				children: [
					react_jsx_runtime.jsx("span", { style: PS.statusLabel, children: props.label }),
					react_jsx_runtime.jsx("span", { style: PS.statusValue, children: props.value })
				]
			});
		}

		/**
		 * The configuration page itself. Mounted only for `view: "page"`.
		 *
		 * State flow: mount → GET /opencode-go/settings → `phase: "ready"` with
		 * the redacted `value` and the `detection` report; the radio seeds from
		 * `value.quotaSource`. Save POSTs `{ patch: { quotaSource }, expectedRevision }`;
		 * 200 refreshes detection and then reloads the canonical value/revision,
		 * 409 shows a reload hint, 503 explains the missing settings descriptor.
		 */
		function SettingsPage(props) {
			const t = translateFor(props);
			const [state, setState] = react.useState({ phase: "loading", revision: 0, value: {}, detection: null, error: null });
			const [choice, setChoice] = react.useState("opencode-go");
			const [busy, setBusy] = react.useState({ save: false, reload: false });
			const [message, setMessage] = react.useState(null);
			// The reload callback must not re-subscribe when the slot hands a new
			// `t` function on every render, so it reads the current translator from
			// a ref instead of the closure.
			const tRef = react.useRef(t);
			tRef.current = t;

			const reload = react.useCallback(async (announce) => {
				const tt = tRef.current;
				try {
					const res = await callApi("GET", SETTINGS_PATH);
					const payload = res.payload;
					if (res.status === 200 && payload !== null) {
						const value = payload.value && typeof payload.value === "object" ? payload.value : {};
						setState({
							phase: "ready",
							revision: typeof payload.revision === "number" ? payload.revision : 0,
							value: value,
							detection: payload.detection && typeof payload.detection === "object" ? payload.detection : null,
							error: null
						});
						setChoice(normalizeSource(value.quotaSource));
						setMessage(announce === true ? { kind: "ok", text: tt("cfg.reloaded") } : null);
						return true;
					}
					const detail = (payload && (payload.error || payload.hint)) || "";
					setState((prev) => ({
						...prev,
						phase: "error",
						error: (res.status === 503 ? tt("cfg.unsupported") : tt("cfg.loadFailed", { error: "HTTP " + res.status })) + (detail === "" ? "" : "[" + detail + "]")
					}));
					return false;
				} catch (error) {
					setState((prev) => ({ ...prev, phase: "error", error: tt("cfg.loadFailed", { error: (error && error.message) || String(error) }) }));
					return false;
				}
			}, []);

			react.useEffect(() => {
				reload(false);
			}, [reload]);

			const save = async () => {
				if (busy.save) return;
				const tt = tRef.current;
				const next = normalizeSource(choice);
				const server = normalizeSource((state.value || {}).quotaSource);
				if (next === server) {
					setMessage({ kind: "info", text: tt("cfg.noChanges") });
					return;
				}
				setBusy((b) => ({ ...b, save: true }));
				setMessage(null);
				try {
					const res = await callApi("POST", SETTINGS_PATH, { patch: { quotaSource: next }, expectedRevision: state.revision });
					const payload = res.payload;
					if (res.status === 200 && payload !== null) {
						setState((prev) => ({
							...prev,
							revision: typeof payload.revision === "number" ? payload.revision : prev.revision,
							detection: payload.detection && typeof payload.detection === "object" ? payload.detection : prev.detection
						}));
						await reload(false);
						setMessage({ kind: "ok", text: tt("cfg.saved") });
					} else if (res.status === 409) {
						setMessage({ kind: "warn", text: tt("cfg.conflict") });
					} else {
						setMessage({ kind: "err", text: tt("cfg.saveFailed", { error: (payload && payload.error) || ("HTTP " + res.status) }) });
					}
				} catch (error) {
					setMessage({ kind: "err", text: tt("cfg.saveFailed", { error: (error && error.message) || String(error) }) });
				} finally {
					setBusy((b) => ({ ...b, save: false }));
				}
			};

			const onReload = async () => {
				if (busy.reload) return;
				setBusy((b) => ({ ...b, reload: true }));
				try {
					await reload(true);
				} finally {
					setBusy((b) => ({ ...b, reload: false }));
				}
			};

			if (state.phase === "loading") {
				return react_jsx_runtime.jsx("div", { style: PS.wrap, children: react_jsx_runtime.jsx("p", { style: PS.hint, children: t("cfg.loading") }) });
			}
			if (state.phase === "error") {
				return react_jsx_runtime.jsx("div", {
					style: PS.wrap,
					children: [
						react_jsx_runtime.jsx("p", { style: PS.err, children: state.error }),
						react_jsx_runtime.jsx("div", {
							style: PS.row,
							children: react_jsx_runtime.jsx("button", {
								style: busy.reload ? { ...PS.button, ...PS.buttonDisabled } : PS.button,
								disabled: busy.reload,
								onClick: onReload,
								children: t("cfg.retry")
							})
						})
					]
				});
			}

			// Everything below is a defensive read: `/opencode-go/settings` on an
			// older host, or a partial detection report, must render rather than
			// throw.
			const value = state.value || {};
			const detection = state.detection || {};
			const og = detection.opencodeGo && typeof detection.opencodeGo === "object" ? detection.opencodeGo : {};
			const account = og.account && typeof og.account === "object" ? og.account : {};
			const fallback = detection.fallback && typeof detection.fallback === "object" ? detection.fallback : null;
			const serverChoice = normalizeSource(value.quotaSource);
			const selected = normalizeSource(choice);
			const dirty = selected !== serverChoice;
			const effectiveSource = normalizeSource(asText(detection.effectiveSource) || serverChoice);
			const mode = normalizeSource(asText(detection.mode) || serverChoice);
			const version = asText(og.version);
			const accountName = asText(account.name);
			const accountRef = asText(account.ref);
			const accountText = accountName !== ""
				? accountName + (accountRef === "" ? "" : " (" + accountRef + ")")
				: accountRef !== "" ? accountRef : t("cfg.status.defaultAccount");
			const unknown = t("cfg.status.unknown");

			const statusRows = [];
			const pushStatus = (key, label, val) => statusRows.push(react_jsx_runtime.jsx(StatusRow, { label: label, value: val }, key));
			pushStatus("mode", t("cfg.status.mode"), sourceLabel(t, mode));
			pushStatus("effective", t("cfg.status.effective"), sourceLabel(t, effectiveSource));
			pushStatus("package", t("cfg.status.package"), og.detected === true ? (version === "" ? t("cfg.status.detected") : "v" + version) : t("cfg.status.notDetected"));
			pushStatus("entry", t("cfg.status.entry"), og.entryFound === true ? t("cfg.status.found") : og.entryFound === false ? t("cfg.status.notFound") : unknown);
			pushStatus("enabled", t("cfg.status.enabled"), og.enabled === true ? t("cfg.status.on") : og.enabled === false ? t("cfg.status.off") : unknown);
			pushStatus("service", t("cfg.status.service"), og.service === true ? t("cfg.status.available") : og.service === false ? t("cfg.status.unavailable") : unknown);
			if (typeof og.compatible === "boolean") {
				pushStatus("compatible", t("cfg.status.compatible"), og.compatible ? t("cfg.status.compatibleYes") : t("cfg.status.compatibleNo"));
			}
			pushStatus("account", t("cfg.status.account"), accountText);
			pushStatus("fallback", t("cfg.status.fallback"), fallback === null
				? t("cfg.status.none")
				: reasonLabel(t, fallback.reason) + (asText(fallback.message) === "" ? "" : " · " + asText(fallback.message)));

			const optionRows = SOURCES.map((src) => react_jsx_runtime.jsx("label", {
				style: selected === src ? { ...PS.option, ...PS.optionActive } : PS.option,
				children: [
					react_jsx_runtime.jsx("input", {
						type: "radio",
						name: "ocg-quota-source",
						checked: selected === src,
						disabled: busy.save || busy.reload,
						style: PS.radio,
						onChange: () => {
							setChoice(src);
							setMessage(null);
						}
					}),
					react_jsx_runtime.jsx("span", {
						style: PS.optionBody,
						children: [
							react_jsx_runtime.jsx("span", { style: PS.optionTitle, children: t(src === "builtin" ? "cfg.option.builtin" : "cfg.option.opencode-go") }),
							react_jsx_runtime.jsx("span", { style: PS.optionDesc, children: t(src === "builtin" ? "cfg.option.builtin.desc" : "cfg.option.opencode-go.desc") })
						]
					})
				]
			}, src));

			const messageStyle = message === null
				? PS.info
				: message.kind === "ok" ? PS.ok : message.kind === "warn" ? PS.warn : message.kind === "err" ? PS.err : PS.info;
			const disabled = busy.save || busy.reload;

			return react_jsx_runtime.jsx("div", {
				style: PS.wrap,
				children: [
					// ---- source choice ----
					react_jsx_runtime.jsx("section", {
						style: PS.card,
						children: [
							react_jsx_runtime.jsx("div", { style: PS.title, children: t("cfg.title") }),
							react_jsx_runtime.jsx("p", { style: PS.hint, children: t("cfg.lead") }),
							react_jsx_runtime.jsx("div", {
								style: { display: "flex", flexDirection: "column", gap: 8 },
								children: optionRows
							})
						]
					}),
					// ---- detection / status panel ----
					react_jsx_runtime.jsx("section", {
						style: PS.card,
						children: [
							react_jsx_runtime.jsx("div", { style: PS.title, children: t("cfg.status.title") }),
							og.detected === true ? null : react_jsx_runtime.jsx("p", { style: PS.hint, children: t("cfg.status.hint.missing") }),
							react_jsx_runtime.jsx("div", {
								style: { display: "flex", flexDirection: "column", gap: 6 },
								children: statusRows
							})
						]
					}),
					// ---- actions and messages ----
					react_jsx_runtime.jsx("section", {
						style: PS.card,
						children: [
							react_jsx_runtime.jsx("div", {
								style: PS.row,
								children: [
									react_jsx_runtime.jsx("button", {
										style: disabled ? { ...PS.buttonPrimary, ...PS.buttonDisabled } : PS.buttonPrimary,
										disabled: disabled,
										onClick: save,
										children: busy.save ? t("cfg.saving") : t("cfg.save")
									}),
									react_jsx_runtime.jsx("button", {
										style: disabled ? { ...PS.button, ...PS.buttonDisabled } : PS.button,
										disabled: disabled,
										onClick: onReload,
										children: busy.reload ? t("cfg.reloading") : t("cfg.reload")
									}),
									dirty ? react_jsx_runtime.jsx("span", { style: PS.warn, children: t("cfg.unsaved") }) : null,
									react_jsx_runtime.jsx("span", {
										style: { ...PS.hint, marginLeft: "auto" },
										children: t("cfg.revision", { n: state.revision })
									})
								]
							}),
							message === null ? null : react_jsx_runtime.jsx("p", { style: messageStyle, children: message.text })
						]
					})
				]
			});
		}

		/** One-line description the panel may render as the bundle's summary. */
		const SUMMARY = "OpenCode GO 额度来源:优先 dsh-opencode-go 当前账号(失败自动回退到 DSH 内置提供商),或固定使用内置提供商。";

		/**
		 * The `plugins.bundle.config` occupant.
		 *
		 * The `view` branch is a component boundary on purpose: {@link SettingsPage}
		 * opens with `useState`/`useEffect`, so the summary — rendered as a plain
		 * string by the panel — must not pass through a hook-bearing parent.
		 *
		 * @param {{ view?: string, t?: Function }} props - owner props; `view` is
		 * `"summary"` or `"page"` (the bundle-level cell only asks for `"page"`,
		 * but the same shape is reused by summary cells).
		 * @returns {string|object} the one-liner, or the configuration page.
		 */
		function BundleConfig(props) {
			if (props !== null && props !== undefined && props.view === "summary") {
				try {
					return translateFor(props)("cfg.summary");
				} catch (_error) {
					return SUMMARY;
				}
			}
			return react_jsx_runtime.jsx(SettingsPage, props && typeof props.t === "function" ? { t: props.t } : {});
		}

		// ── cordis plugin entry ──
		const inject = ["slots", "locale"];

		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-opencode-go-usage: dictionaries");
			const registerWidget = () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: PACKAGE_NAME,
				order: 0,
				label: "OpenCode GO",
				locale: NS
			}, Widget);
			const registerConfig = () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: CONFIG_KEY,
				locale: NS
			}, BundleConfig);
			// The settings page is additive: a host that predates the Plugins
			// panel (or a slots service without `inject`) must lose only this
			// page, never the widget. `inject` waits for the panel to declare the
			// slot, so an absent slot simply never fires; the fallback branch is
			// wrapped because an unknown slot name may throw there.
			const registerConfigSafely = () => {
				try {
					registerConfig();
				} catch (_error) {
					// no plugins.bundle.config slot in this composition
				}
			};
			if (typeof ctx.slots.inject === "function") {
				ctx.slots.inject("sidebar.footer.action", registerWidget);
				// `inject` waits for the Plugins panel to declare the slot, so this
				// bundle loads in either order. A key mismatch would not error — the
				// section would simply not render — hence CONFIG_KEY === PACKAGE_NAME.
				try {
					ctx.slots.inject("plugins.bundle.config", registerConfigSafely);
				} catch (_error) {
					// older slots service: the widget alone still works
				}
			} else {
				ctx.effect(registerWidget, "dsh-opencode-go-usage: widget registration");
				ctx.effect(registerConfigSafely, "dsh-opencode-go-usage: settings page registration");
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.CONFIG_KEY = CONFIG_KEY;
		exports.SUMMARY = SUMMARY;
		exports.Widget = Widget;
		exports.BundleConfig = BundleConfig;
		exports.SettingsPage = SettingsPage;
		return module.exports;
	}
});
