# Twilight Struggle Game Report

An unofficial fan tool for Playdek's Twilight Struggle game logs created using the TSEspionage mod: an end-of-game report for the digital Twilight Struggle. Drop in your game logs (.txt) to see:

- coup dice averages
- battleground flips
- wars won
- Ops played by era
- scoring cards played
- how the game ended

Everything runs in your browser. Your logs are read on your device and kept only in your browser's local storage. Nothing is uploaded to a server.

## Use it

Live at https://mpheinze.github.io/ts-game-report/ once GitHub Pages is enabled.


Open the site, then drop one or more Playdek game log files onto the page, or click **Choose log files**. Use **Clear my games** to remove the logs from your browser.

## Project structure

```
index.html          page markup; loads the files below
css/base.css        page shell: fonts, colours, upload panel, buttons
css/report.css      the report layout (scoreboard, coup rolls, Ops played, scorings)
js/reference.js     card, country and region reference data
js/tsparse.js       log parser: turns a Playdek log into one row of game stats
js/engine.js        keeps the games in localStorage and redraws the report
js/report.js        draws each part of the report
js/upload.js        file picker, drag and drop, clear button
```

There is no build step and no server code. GitHub Pages serves the `main` branch as it is. To run it locally, open `index.html` in a browser.

---

Unofficial fan tool. Twilight Struggle is © GMT Games. This site is not affiliated with GMT Games or Playdek.
