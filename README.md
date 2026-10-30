# Royal Quiz Race

A small, no-login quiz game for friends. It uses a Node.js server and plain browser files, so there are no packages to install.

## Run it on your computer

1. Install Node.js 18 or newer if it is not already installed.
2. Open a terminal in this folder.
3. Run `npm start`.
4. On this computer, open `http://localhost:3000`.
5. One player selects **Create Room** and enters a nickname. The other player selects **Join Room**, enters the 4-letter code and a nickname. The host can start when two players have joined.

To run the built-in server-flow check, open a second terminal and run `npm test`.

To test two players on one computer, open a private/incognito window for the second player. Each browser keeps its own player token.

## Invite friends on other devices

The room code and share link work on phones and laptops when everyone can reach the same running server. For play over the public internet, deploy this folder as a Node.js web service on a host that supports long-running Node apps. Set its start command to `npm start` and let the host provide the `PORT` environment variable. Share the deployed page URL. Keep one server process running: rooms are stored in memory and are cleared when the server restarts.

For a quick home Wi-Fi test, find this computer's local network address and share `http://YOUR-COMPUTER-IP:3000/?room=CODE`. The phone/laptop must be on that same Wi-Fi, and the network firewall must allow port 3000.

## Game rules

- A host starts a 10-question game after at least two people join.
- Each question is open for 10 seconds and earns up to 1,000 points for a fast correct answer. Double Gold doubles that question's points.
- Each player gets one Double Gold and one 50-50 per game. 50-50 removes two incorrect choices.
- After each question, players see the answer, scores, and power-ups used.
- A person joining after a game starts watches that game. They can play when the host starts the next one.
- Refreshing the page reconnects using a token saved in that browser. The room host role moves to another connected player if the host leaves.

## Notes

- Room names and scores live only in server memory. Restarting the app clears rooms.
- Question text is original general knowledge trivia written for this game.
- No player accounts or third-party services are used.
