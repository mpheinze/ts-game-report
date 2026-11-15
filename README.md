# Twilight Struggle Game Report

An unofficial fan tool for Playdek's Twilight Struggle game logs created using the TSArmsRace mod: an end-of-game report for the digital Twilight Struggle. Drop in your game logs (.txt) to see:

- coup dice averages
- battleground flips
- wars won
- Ops played by era
- scoring cards played
- how the game ended

Everything runs in your browser. Your logs are read on your device and kept only in your browser's local storage. Nothing is uploaded to a server.

## Getting your game logs

The Twilight Struggle game doesn't save game logs by itself. They are written by **TSArmsRace**, a fan-made mod pack for the Steam version of Twilight Struggle (Windows and macOS). Its Game Log Writer saves one log file per game.

1. Download the latest `TSArmsRace-windows.zip` or `TSArmsRace-macos.zip` from the [TSArmsRace releases page](https://github.com/ctozlowski/TSArmsRace/releases/latest).
2. In Steam, right-click **Twilight Struggle** → **Manage** → **Browse Local Files**, and extract the zip into that folder. On macOS you also need to set a Steam launch option.
3. Launch the game. The first start can take a minute or two, and you may need to launch it twice before the mods are active.
4. Check that `TSGameLog=true` is set in `BepInEx/plugins/mods.cfg` (it is on in a fresh install).

Logs are then saved to **Desktop/Twilight Struggle/**, one file per game, named by game ID (for example `3415310.txt`). The full install and troubleshooting steps are in the [TSArmsRace README](https://github.com/ctozlowski/TSArmsRace#readme).

TSArmsRace is a third-party project by ctozlowski. It isn't made by this site, Playdek or GMT Games.

## Use it

The site is live at https://mpheinze.github.io/ts-game-report/

Open the site, then drop one or more log files from your `Desktop/Twilight Struggle` folder onto the page, or click **Choose log files**. Use **Clear my games** to remove the logs from your browser.

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
