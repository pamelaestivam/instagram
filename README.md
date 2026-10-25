# Follower Analyzer

Analyze an Instagram profile's followers and find who doesn't follow you back. Runs 100% in the browser from Instagram's official data export — no login, no password, nothing uploaded anywhere.

## Use

1. Instagram → Settings and activity → Accounts Center → Your information and permissions → **Export your information** → export to device, choose **Followers and following**, **All time**, format **JSON**.
2. Unzip the download (`connections/followers_and_following/`).
3. Open `index.html` in a browser and drop in `followers_1.json` and `following.json` (or the whole folder).

You get: non-followers, fans, mutuals, follow-back rate, followers gained per month, search, copy and CSV download. Each upload is also saved as a snapshot in your browser's localStorage, so the *next* upload shows who left and who joined since then.

## Develop

```
npm test
```
