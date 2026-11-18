# Twilight Struggle Game Report: project context

A static website that turns Playdek Twilight Struggle game logs into an end-of-game report.

- Live site (GitHub Pages, served from `main`): https://mpheinze.github.io/ts-game-report/
- Owner: mpheinze, who plays as **wirus_**.
- Logs are written by the TSArmsRace mod (https://github.com/ctozlowski/TSArmsRace) to `Desktop/Twilight Struggle/<game id>.txt`. The owner's own logs, plus the reference data and the original Python parser, are in `C:\Users\heinz\OneDrive\Desktop\Twilight Struggle` on his PC.

## Workflow (agreed with the owner)

1. **Never push to `main` without the owner's approval.** `main` is production.
2. Make each change on a branch (`feature/<short-name>` or `fix/<short-name>`), commit and push it, and open a pull request. `gh auth status` reports a failure in these sessions and `gh pr create` is blocked (it uses GraphQL), but the REST API works: `gh api -X POST repos/mpheinze/ts-game-report/pulls -f base=main -f head=<branch> -f title=… -f body=…`. Merge with `gh api -X PUT repos/mpheinze/ts-game-report/pulls/<n>/merge`, but only after the owner approves.
3. **Preview:** publish the branch's files as a *private* Claude artifact so the owner can try them before merging. Use the Artifact tool's `publish_files` with `index.html`, `css/*` and `js/*`, each kept at its repo path. Reuse the same preview artifact each time (republish with its slug) and record the slug below.
4. Merge only when the owner says so. Merge by fast-forwarding `main` or by the owner clicking Merge on GitHub.
5. Before pushing any CSS or JS change, bump the `?v=` number on **every** `<link>`/`<script>` in `index.html`. GitHub Pages caches pages for about 10 minutes. If the owner still sees an old version, Ctrl+F5 fixes it.

Preview artifact slug: `0f846c1c-9282-4892-adcb-64d91dfe80d9` ("TS Game Report – preview", https://claude.ai/artifact/2v8tkuZs9wmUbvbiE9bbyr). Before republishing, call get_artifact (or list_files) for the current base_version.

## Code layout

No build step and no server code; everything runs in the browser.

```
index.html          markup: top bar (game picker | title | Add games, Clear my games), landing view, report cards
css/report.css      report styling; colour variables live in :root
css/base.css        page layout, top bar, cards, landing, phone and wide-screen rules (loaded AFTER report.css: order matters)
js/reference.js     window.TS_REFERENCE: cards, log-name aliases, countries, region scoring
js/tsparse.js       window.TSParse.parseLogs(files, meName) -> { rows, skipped }; one row of stats per game
js/engine.js        window.dash shim (data/params/draw), localStorage key `tsr-games-v1`, render()
js/report.js        dash.draw(...) for every [data-draw] element, VP timeline, "?" help texts (HELP map)
js/upload.js        file picker, drag and drop, Clear my games
```

Each visitor's games are stored only in their own browser's localStorage, so nothing is shared between users. If you add a new field to the parsed rows, games saved earlier won't have it. Make the report degrade gracefully (show a short "add this game's log again" note) and tell the owner to re-add the logs.

## Parser facts worth knowing

- The logs never print the game result, DEFCON 1 or some final scoring results. The ending is inferred by replaying the board. Victory conditions V1–V10 are defined in `reference\victory_conditions.md` in the owner's folder. **Read that file whenever a question touches how games end.** Keep the victory conditions only in that file.
- Coup line: `SUCCESS|FAILURE: die [ + ops (mod) - 2xS = res ]`. Realignment: `X rolls d (+m) = t`. War: `VICTORY|DEFEAT: die`. Space Race: `Die roll: d -- …`. VP: `… gains N VP. Score is US n|USSR n|even`.
- Playdek numbers `Turn N, Cleanup` headers by action-round count, not by game turn. The timeline keeps cleanup in the turn it follows.
- VP printed on an action-round header before the card resolves come from Flower Power (USSR +2, US played a war card) or We Will Bury You (USSR +3).
- Final Scoring lines appear after the last action round, separated by a blank line.
- Ops rules:
  - Red Scare/Purge −1 for the opponent of whoever played it.
  - Containment +1 for the US, Brezhnev Doctrine +1 for the USSR. Both are capped at 4.
  - The China Card is worth 5 Ops when all of its Ops go into Asia.
  - "Costly" Ops come from an opponent-aligned card whose event fired, or one sent to the Space Race.
- Wars: Korean War and Arab-Israeli War always count for the USSR. Neutral wars count for whoever played them.
- A battleground flip is a coup in a battleground the opponent controlled before the coup and the coup-maker controlled after it.
- Row fields include:
  - per side: `{us,ussr}_{coup_all,coup_bg,coup_nonbg,…}_{avg,n}`, `{p}_bg_flips`, `{p}_wars_won`, `{p}_{early,mid,late,game}_{total,costly,scorings,four,avg_ops}`, `{p}_scoring_seq` ([card, turn]…)
  - per game: `vp_timeline` ([turn, phase, AR, card, vp, [[delta, source]…], usage]…), `power_plays` ([card, side, turn, how]… for Brush War 36, Junta 47, ABM Treaty 57)

## Testing before every push

- Stage the owner's logs from his PC into `/mnt/user-data/uploads/Twilight Struggle/`, then load them all into the page with Playwright (`set_input_files('#add-file', …)`).
- Check:
  - no page errors;
  - the stats match the previous version for all games;
  - the coup roll bars and 3.5 markers line up;
  - the help popovers show text;
  - the layout works at 1920, 1366 and 390 px wide;
  - the page also works with the browser set to dark mode.
- Look at screenshots of whatever changed.

## Design preferences

- US always on the left, USSR on the right.
- Colours: US #3f6fc0, USSR #c4463d, plus their soft and tint variants.
- Icons: ★ for the US, ☭ for the USSR. Section headers are centred between ★ and ☭ rules.
- Style: minimal and tidy, with no explanatory filler text in the report. Definitions go in the "?" help popovers.
- Scoring card colours:
  - Asia #F3A638
  - Europe #A499C3/#BFB7D6 (two-tone)
  - Middle East #C4E4F5
  - Central America #C8D896
  - Southeast Asia #F3A638/#FFD200 (two-tone)
  - Africa #F7E396
  - South America #9AC284
- VP timeline: y-axis fixed at USSR 20 to US 20, with ticks only at Even, 10 and 20 and no plus signs. Hover shows the card, how it was used (Event, Influence, Coup, Realignment, Space Race, Discarded), each VP change with a short source name, and the score after it.
- No GMT card images or artwork (copyright).
- Never suggest making a spreadsheet.
